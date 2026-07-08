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

// Normalize strings for matching: lowercase, collapse whitespace, strip invisible unicode chars
export function normalizeForMatch(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, ' ').replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '');
}

export type CloneProgress = {
  phase: "listing" | "creating_folders" | "copying" | "done";
  message: string;
  done: number;
  total: number;
  errors?: string[];
};

export type TreeNode =
  | { kind: "folder"; id: string; name: string; children: TreeNode[] }
  | { kind: "file"; id: string; name: string; mimeType: string; shortcutTarget?: { id: string; mimeType: string } };

async function withNitroRetry<T>(fn: () => Promise<T>, tries = 8) {
  let lastErr: any;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e: any) {
      lastErr = e;
      const msg = e?.message || String(e);
      
      // Determine if the error is a transient rate limit/quota or server error
      let isRetryable = false;
      if (msg.includes("[429]") || msg.includes("[500]") || msg.includes("[502]") || msg.includes("[503]") || msg.includes("[504]")) {
        isRetryable = true;
      } else if (msg.includes("[403]")) {
        // Only retry 403 if it is a rate limit or quota issue, not for permission denied
        isRetryable = /rateLimitExceeded|userRateLimitExceeded|quotaExceeded|usageLimits/i.test(msg);
      }
      
      if (!isRetryable || i === tries - 1) throw e;
      
      // Google rate limits cool down better with longer backoffs and random jitter
      const backoff = 150 * Math.pow(2, i) + Math.random() * 100;
      await new Promise(r => setTimeout(r, backoff)); 
    }
  }
  throw lastErr;
}

export async function buildPublicFolderTree(params: {
  apiKey?: string;
  accessToken?: string;
  rootFolderId: string;
  onProgress?: (p: CloneProgress) => void;
  concurrency?: number;
  filterKeywords?: string[]; // NEW: Auto-Filter keywords
}) {
  const limit = createLimiter(20);
  const keywords = params.filterKeywords?.map(k => k.toLowerCase().trim()) || [];
  let itemsCount = 0;

  async function walk(folderId: string, folderName: string): Promise<TreeNode> {
    params.onProgress?.({ phase: "listing", message: `Nitro Scanning: ${itemsCount} items found...`, done: 0, total: 0 });
    const children = await withNitroRetry(() => limit(() => publicDriveListChildren({
      apiKey: params.apiKey,
      accessToken: params.accessToken,
      folderId,
    })));

    const folders: any[] = [];
    const files: any[] = [];

    for (const item of children) {
      // NITRO CLEANER: Auto-skip files matching keywords
      const lowerName = item.name.toLowerCase();
      if (keywords.some(k => k && lowerName.includes(k))) continue;

      itemsCount++;

      if (item.mimeType === "application/vnd.google-apps.folder" || (item.mimeType === "application/vnd.google-apps.shortcut" && item.shortcutDetails?.targetMimeType === "application/vnd.google-apps.folder")) {
        folders.push({ id: item.shortcutDetails?.targetId || item.id, name: item.name });
      } else {
        files.push(item);
      }
    }

    const folderNodes = await Promise.all(folders.map(f => walk(f.id, f.name)));
    const fileNodes = files.map(f => ({
      kind: "file",
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      ...(f.mimeType === "application/vnd.google-apps.shortcut" ? { shortcutTarget: { id: f.shortcutDetails.targetId, mimeType: f.shortcutDetails.targetMimeType } } : {})
    }));

    return { kind: "folder", id: folderId, name: folderName, children: [...folderNodes, ...fileNodes] } as TreeNode;
  }

  // Fetch real root name and mimeType
  let realRootName = "Nitro Clone";
  let realRootMime = "application/vnd.google-apps.folder";
  let shortcutTargetMimeType: string | undefined;
  let shortcutTargetId: string | undefined;

  try {
    const meta = await publicDriveGetFileMetadata({ apiKey: params.apiKey, accessToken: params.accessToken, fileId: params.rootFolderId });
    if (meta?.name) realRootName = meta.name;
    if (meta?.mimeType) realRootMime = meta.mimeType;
    if (meta?.shortcutDetails) {
      shortcutTargetMimeType = meta.shortcutDetails.targetMimeType;
      shortcutTargetId = meta.shortcutDetails.targetId;
    }
  } catch {}

  const isFolder =
    realRootMime === "application/vnd.google-apps.folder" ||
    (realRootMime === "application/vnd.google-apps.shortcut" && shortcutTargetMimeType === "application/vnd.google-apps.folder");

  if (!isFolder) {
    return {
      kind: "file",
      id: params.rootFolderId,
      name: realRootName,
      mimeType: realRootMime,
      ...(realRootMime === "application/vnd.google-apps.shortcut" && shortcutTargetId && shortcutTargetMimeType
        ? { shortcutTarget: { id: shortcutTargetId, mimeType: shortcutTargetMimeType } }
        : {})
    } as TreeNode;
  }

  const effectiveFolderId = (realRootMime === "application/vnd.google-apps.shortcut" && shortcutTargetId)
    ? shortcutTargetId
    : params.rootFolderId;

  return walk(effectiveFolderId, realRootName);
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
  selectedIds?: Set<string>;
  injectedFiles?: File[];
  filterKeywords?: string[]; // NEW: Auto-Filter keywords
  exactFilterNames?: string[]; // Exact file names to skip & replace with injected files
}) {
  const onProgress = params.onProgress;
  const turboLimit = createLimiter(params.concurrency || 15);
  
  // SCAN (NitroDrive now handles this background even if user didn't click scan)
  const tree = await buildPublicFolderTree({ 
    apiKey: params.apiKey, 
    accessToken: params.accessToken, 
    rootFolderId: params.rootFolderId, 
    onProgress,
    filterKeywords: params.filterKeywords
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

  const flattenFiles: any[] = [];
  const exactNames = new Set((params.exactFilterNames || []).map(n => normalizeForMatch(n)).filter(Boolean));
  const replacementSlots: { originalName: string; parentId: string }[] = [];
  onProgress?.({ phase: "creating_folders", message: "Nitro Initializing...", done: 0, total: 0 });

  if (tree.kind === "file") {
    if (params.selectedIds && !params.selectedIds.has(tree.id)) {
      onProgress?.({ phase: "done", message: "No files selected.", done: 0, total: 0 });
      return { totalFiles: 0, destinationFolderId: "" };
    }
    const total = 1;
    let done = 0;
    onProgress?.({ phase: "copying", message: `Nitro Cloning: ${done}/${total}`, done, total });

    const sourceId = tree.shortcutTarget?.id ?? tree.id;
    let copiedFileId = "";
    try {
      const res = await withNitroRetry(() => myDriveCopyFile({ 
        accessToken: params.accessToken, 
        sourceFileId: sourceId, 
        name: nameTransform(tree.name) 
      }));
      copiedFileId = res.id;
    } catch {
      const dl = await withNitroRetry(() => publicDriveDownloadFile({ 
        apiKey: params.apiKey, 
        accessToken: params.accessToken, 
        fileId: sourceId, 
        mimeType: tree.mimeType 
      }));
      const res = await withNitroRetry(() => myDriveUploadFile({ 
        accessToken: params.accessToken, 
        name: nameTransform(tree.name + dl.nameSuffix), 
        blob: dl.blob, 
        contentType: dl.contentType 
      }));
      copiedFileId = res.id;
    }
    done++;
    onProgress?.({ phase: "done", message: "Nitro Transfer Complete!", done, total });
    return { totalFiles: total, destinationFolderId: copiedFileId };
  }
  
  const rootDest = await withNitroRetry(() => myDriveCreateFolder({ 
    accessToken: params.accessToken, 
    name: params.destFolderName || tree.name 
  }));

  // Count total subfolders to create for progress logging
  let totalFolders = 0;
  const countSubfolders = (node: TreeNode) => {
    if (params.selectedIds && !params.selectedIds.has(node.id)) return;
    if (node.kind === "folder") {
      totalFolders++;
      node.children.forEach(countSubfolders);
    }
  };
  tree.children.forEach(countSubfolders);

  let foldersCreated = 0;
  const folderLimit = createLimiter(10); // Safe limit (10 QPS) to speed up folder creation by ~66%

  async function processNode(node: TreeNode, destParentId: string) {
    if (params.selectedIds && !params.selectedIds.has(node.id)) {
      // Track replacement slots for exact-filtered files so injected files go to the same folder
      if (node.kind === "file" && exactNames.has(normalizeForMatch(node.name))) {
        replacementSlots.push({ originalName: node.name, parentId: destParentId });
      }
      return;
    }
    if (node.kind === "file") {
      flattenFiles.push({ node, parentId: destParentId });
      return;
    }
    const created = await withNitroRetry(() => folderLimit(() => myDriveCreateFolder({ accessToken: params.accessToken, name: nameTransform(node.name), parentId: destParentId })));
    foldersCreated++;
    onProgress?.({ 
      phase: "creating_folders", 
      message: `Nitro Initializing: Creating folder ${foldersCreated}/${totalFolders}...`, 
      done: foldersCreated, 
      total: totalFolders > 0 ? totalFolders : 1 
    });
    await Promise.all(node.children.map(c => processNode(c, created.id)));
  }

  await Promise.all(tree.children.map(c => processNode(c, rootDest.id)));

  // Collect ALL unique parent folders where exact-filtered promo files were found
  const uniqueReplacementParents = [...new Set(replacementSlots.map(s => s.parentId))];
  const injectedFileCount = params.injectedFiles?.length || 0;
  // Each injected file goes into EVERY folder that had promo files
  const injectionCount = injectedFileCount > 0 && uniqueReplacementParents.length > 0
    ? injectedFileCount * uniqueReplacementParents.length
    : injectedFileCount;

  const total = flattenFiles.length + injectionCount;
  let done = 0;
  let failed = 0;
  const failedErrors: string[] = [];

  const copyTask = async (item: any) => {
    const sourceId = item.node.shortcutTarget?.id ?? item.node.id;
    try {
      try {
        await withNitroRetry(() => myDriveCopyFile({ accessToken: params.accessToken, sourceFileId: sourceId, parentId: item.parentId, name: nameTransform(item.node.name) }));
      } catch (copyErr) {
        // Fallback: download and upload
        const dl = await withNitroRetry(() => publicDriveDownloadFile({ apiKey: params.apiKey, accessToken: params.accessToken, fileId: sourceId, mimeType: item.node.mimeType }));
        await withNitroRetry(() => myDriveUploadFile({ accessToken: params.accessToken, parentId: item.parentId, name: nameTransform(item.node.name + dl.nameSuffix), blob: dl.blob, contentType: dl.contentType }));
      }
    } catch (err: any) {
      console.warn(`Failed to clone ${item.node.name}:`, err);
      failed++;
      const errMsg = err?.message || String(err);
      failedErrors.push(`${item.node.name}: ${errMsg}`);
    } finally {
      done++;
      const msg = failed > 0 
        ? `Nitro Cloning: ${done}/${total} (${failed} failed)` 
        : `Nitro Cloning: ${done}/${total}`;
      onProgress?.({ phase: "copying", message: msg, done, total, errors: failedErrors });
    }
  };

  await Promise.all(flattenFiles.map(item => turboLimit(() => copyTask(item))));

  if (params.injectedFiles?.length) {
    // Upload ALL injected files into EVERY folder where promo files were removed
    const targetFolders = uniqueReplacementParents.length > 0 ? uniqueReplacementParents : [rootDest.id];
    const injectionTasks = targetFolders.flatMap(parentId =>
      params.injectedFiles!.map((f) => turboLimit(async () => {
        try {
          await withNitroRetry(() => myDriveUploadFile({ accessToken: params.accessToken, parentId, name: f.name, blob: f, contentType: f.type }));
        } catch (err: any) {
          console.warn(`Failed to inject file ${f.name}:`, err);
          failed++;
          const errMsg = err?.message || String(err);
          failedErrors.push(`${f.name}: ${errMsg}`);
        } finally {
          done++;
          const msg = failed > 0 
            ? `Nitro Cloning: ${done}/${total} (${failed} failed)` 
            : `Nitro Cloning: ${done}/${total}`;
          onProgress?.({ phase: "copying", message: msg, done, total, errors: failedErrors });
        }
      }))
    );
    await Promise.all(injectionTasks);
  }

  onProgress?.({ phase: "done", message: failed > 0 ? `Nitro Transfer Complete! (${failed} failed)` : "Nitro Transfer Complete!", done: total, total, errors: failedErrors });
  return { totalFiles: total, destinationFolderId: rootDest.id };
}
