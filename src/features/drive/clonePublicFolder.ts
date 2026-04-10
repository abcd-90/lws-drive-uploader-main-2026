import { createLimiter } from "@/features/drive/cloneUtils";
import { myDriveCopyFile, myDriveCreateFolder, myDriveUploadFile } from "@/features/drive/myDriveApi";
import {
  parseDriveFolderId,
  publicDriveDownloadFile,
  publicDriveGetFileMetadata,
  publicDriveListChildren,
  type DrivePublicFile,
} from "@/features/drive/publicDriveApi";

export type { DrivePublicFile };
export { parseDriveFolderId };

export type CloneProgress = {
  phase: "listing" | "creating_folders" | "copying" | "done";
  message: string;
  done: number;
  total: number;
};

type TreeNode =
  | {
      kind: "folder";
      id: string;
      name: string;
      children: TreeNode[];
    }
  | {
      kind: "file";
      id: string;
      name: string;
      mimeType: string;
      // Google Drive shortcuts inside public folders are common.
      // If present, we clone the shortcut target.
      shortcutTarget?: {
        id: string;
        mimeType: string;
      };
    };

export async function buildPublicFolderTree(params: {
  apiKey?: string;
  accessToken?: string;
  rootFolderId: string;
  onProgress?: (p: CloneProgress) => void;
  concurrency?: number;
}) {
  const onProgress = params.onProgress;

  // NOTE: Avoid limiter-based recursive fan-out here, it can deadlock on deep folder trees
  // when parent tasks wait for children while holding all limiter slots.

  async function walk(folderId: string, folderName: string, depth: number): Promise<TreeNode> {
    onProgress?.({
      phase: "listing",
      message: `Listing: ${"  ".repeat(Math.min(depth, 6))}${folderName}`,
      done: 0,
      total: 0,
    });

    const children = await publicDriveListChildren({
      apiKey: params.apiKey,
      // IMPORTANT: Prefer API-key based listing when apiKey is present.
      // OAuth listing can miss link-shared items, resulting in empty/partial nested folders.
      accessToken: params.apiKey ? undefined : params.accessToken,
      folderId,
    });

    const folders: Array<{ id: string; name: string }> = [];
    const files: DrivePublicFile[] = [];

    for (const item of children) {
      // Shortcut pointing to folder should be treated as a folder, not a file.
      if (
        item.mimeType === "application/vnd.google-apps.shortcut" &&
        item.shortcutDetails?.targetId &&
        item.shortcutDetails?.targetMimeType === "application/vnd.google-apps.folder"
      ) {
        folders.push({ id: item.shortcutDetails.targetId, name: item.name });
        continue;
      }

      if (item.mimeType === "application/vnd.google-apps.folder") {
        folders.push({ id: item.id, name: item.name });
      } else {
        files.push(item);
      }
    }

    const folderNodes: TreeNode[] = [];
    for (const folder of folders) {
      folderNodes.push(await walk(folder.id, folder.name, depth + 1));
    }

    const fileNodes: TreeNode[] = files.map((f) => {
      const isShortcut = f.mimeType === "application/vnd.google-apps.shortcut";
      const targetId = f.shortcutDetails?.targetId;
      const targetMimeType = f.shortcutDetails?.targetMimeType;

      return {
        kind: "file",
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        ...(isShortcut && targetId && targetMimeType
          ? {
              shortcutTarget: {
                id: targetId,
                mimeType: targetMimeType,
              },
            }
          : {}),
      };
    });

    return { kind: "folder", id: folderId, name: folderName, children: [...folderNodes, ...fileNodes] };
  }

  // Prefer showing the real source name (works for both folder + single file input).
  let rootName = "Source Folder";
  try {
    const meta = await publicDriveGetFileMetadata({
      apiKey: params.apiKey,
      // Only use OAuth if no apiKey.
      accessToken: params.apiKey ? undefined : params.accessToken,
      fileId: params.rootFolderId,
    });

    if (meta?.name) rootName = meta.name;

    // Single file link/id support: clone as one-item tree.
    if (meta?.mimeType && meta.mimeType !== "application/vnd.google-apps.folder") {
      const singleFileTree: TreeNode = {
        kind: "folder",
        id: params.rootFolderId,
        name: "Source File",
        children: [
          {
            kind: "file",
            id: meta.id,
            name: meta.name,
            mimeType: meta.mimeType,
          },
        ],
      };
      return singleFileTree;
    }
  } catch {
    // ignore; fallback to generic name
  }

  return walk(params.rootFolderId, rootName, 0);
}

function countFiles(node: TreeNode): number {
  if (node.kind === "file") return 1;
  return node.children.reduce((acc, c) => acc + countFiles(c), 0);
}

export async function clonePublicFolderToMyDrive(params: {
  apiKey?: string;
  accessToken: string;
  rootFolderId: string;
  destFolderName?: string;
  removeWord?: string;
  creditText?: string;
  onProgress?: (p: CloneProgress) => void;
  concurrency?: number;
}) {
  const onProgress = params.onProgress;
  const maxCopyConcurrency = 24;
  const safeCopyConcurrency = Math.max(1, Math.min(maxCopyConcurrency, params.concurrency ?? 12));
  const limit = createLimiter(safeCopyConcurrency);

  const tree = await buildPublicFolderTree({
    apiKey: params.apiKey,
    accessToken: params.accessToken,
    rootFolderId: params.rootFolderId,
    onProgress,
    concurrency: Math.max(1, Math.min(maxCopyConcurrency, params.concurrency ?? 12)),
  });

  const totalFiles = countFiles(tree);
  let done = 0;

  onProgress?.({ phase: "creating_folders", message: "Creating destination folders...", done: 0, total: totalFiles });

  const requestedName = params.destFolderName?.trim();
  const rootDestName = requestedName || tree.name || `Cloned - ${params.rootFolderId.slice(0, 8)}`;

  const rootDest = await myDriveCreateFolder({
    accessToken: params.accessToken,
    name: rootDestName,
  });

  const nameTransform = (name: string) => {
    let out = name;
    if (params.removeWord) out = out.split(params.removeWord).join("");
    if (params.creditText) {
      const dot = out.lastIndexOf(".");
      if (dot > 0) out = `${out.slice(0, dot)} ${params.creditText}${out.slice(dot)}`;
      else out = `${out} ${params.creditText}`;
    }
    return out.trim();
  };

  async function withRetry<T>(fn: () => Promise<T>, opts?: { tries?: number; baseDelayMs?: number }) {
    const tries = Math.max(1, opts?.tries ?? 4);
    const base = Math.max(50, opts?.baseDelayMs ?? 250);

    let lastErr: unknown;
    for (let i = 0; i < tries; i++) {
      try {
        return await fn();
      } catch (e) {
        lastErr = e;
        const msg = e instanceof Error ? e.message : String(e);
        const isRetryable = /\[(429|5\d\d)\]/.test(msg) || /rate limit|quota|backendError|timeout/i.test(msg);
        if (!isRetryable || i === tries - 1) throw e;
        // exponential backoff with small jitter
        const delay = Math.round(base * Math.pow(2, i) + Math.random() * 120);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  }

  async function copyFile(node: Extract<TreeNode, { kind: "file" }>, parentDestId: string) {
    onProgress?.({ phase: "copying", message: `Copying: ${node.name}`, done, total: totalFiles });

    const sourceId = node.shortcutTarget?.id ?? node.id;

    // Fast path: server-side copy inside Drive (no download/upload). This is the biggest speed + reliability win.
    try {
      const finalName = nameTransform(node.name);
      await withRetry(
        () =>
          myDriveCopyFile({
            accessToken: params.accessToken,
            sourceFileId: sourceId,
            parentId: parentDestId,
            name: finalName,
          }),
        { tries: 5, baseDelayMs: 150 },
      );

      done += 1;
      onProgress?.({ phase: "copying", message: `Copied: ${finalName}`, done, total: totalFiles });
      return;
    } catch {
      // Fallback path: for edge cases where Drive copy is not permitted for this file.
      const mimeForDownload = node.shortcutTarget?.mimeType ?? node.mimeType;
      const dl = await withRetry(
        () =>
          publicDriveDownloadFile({
            apiKey: params.apiKey,
            accessToken: params.accessToken,
            fileId: sourceId,
            mimeType: mimeForDownload,
          }),
        { tries: 4, baseDelayMs: 200 },
      );
      const finalName = nameTransform(node.name + dl.nameSuffix);

      await withRetry(
        () =>
          myDriveUploadFile({
            accessToken: params.accessToken,
            parentId: parentDestId,
            name: finalName,
            blob: dl.blob,
            contentType: dl.contentType,
          }),
        { tries: 4, baseDelayMs: 220 },
      );

      done += 1;
      onProgress?.({ phase: "copying", message: `Uploaded: ${finalName}`, done, total: totalFiles });
    }
  }

  async function copyNode(node: TreeNode, parentDestId: string): Promise<void> {
    if (node.kind === "file") {
      await limit(() => copyFile(node, parentDestId));
      return;
    }

    const created = await myDriveCreateFolder({
      accessToken: params.accessToken,
      name: nameTransform(node.name),
      parentId: parentDestId,
    });

    const childFolders = node.children.filter((child): child is Extract<TreeNode, { kind: "folder" }> => child.kind === "folder");
    const childFiles = node.children.filter((child): child is Extract<TreeNode, { kind: "file" }> => child.kind === "file");

    // Process nested folders in parallel for faster deep-tree cloning.
    await Promise.all(childFolders.map((folder) => copyNode(folder, created.id)));

    // Process files in parallel with bounded concurrency.
    await Promise.all(childFiles.map((file) => limit(() => copyFile(file, created.id))));
  }

  if (tree.kind !== "folder") throw new Error("Root is not a folder (invalid public folder tree)");

  const rootFolders = tree.children.filter((child): child is Extract<TreeNode, { kind: "folder" }> => child.kind === "folder");
  const rootFiles = tree.children.filter((child): child is Extract<TreeNode, { kind: "file" }> => child.kind === "file");

  await Promise.all(rootFolders.map((folder) => copyNode(folder, rootDest.id)));

  await Promise.all(rootFiles.map((file) => limit(() => copyFile(file, rootDest.id))));

  onProgress?.({ phase: "done", message: "Done! Folder cloned to your Drive.", done: totalFiles, total: totalFiles });

  return {
    totalFiles,
    destinationFolderId: rootDest.id,
    destinationFolderName: rootDestName,
  };
}
