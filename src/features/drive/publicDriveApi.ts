import { fetchWithTimeout } from "@/features/drive/cloneUtils";

export type DrivePublicFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  shortcutDetails?: {
    targetId?: string;
    targetMimeType?: string;
  };
};

export function parseDriveFolderId(input: string) {
  const trimmed = input.trim();

  // folder link: https://drive.google.com/drive/folders/<id>
  const folderMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch?.[1]) return folderMatch[1];

  // file link: https://drive.google.com/file/d/<id>/view
  const fileMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch?.[1]) return fileMatch[1];

  // shared/open links: ...?id=<id> or .../uc?id=<id>
  const urlMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (urlMatch?.[1]) return urlMatch[1];

  // raw id
  if (/^[a-zA-Z0-9_-]{10,}$/.test(trimmed)) return trimmed;
  return null;
}

function buildListUrl(params: {
  apiKey?: string;
  q: string;
  pageToken?: string;
  useOAuth?: boolean;
}) {
  const sp = new URLSearchParams();
  sp.set("q", params.q);
  sp.set("fields", "nextPageToken,files(id,name,mimeType,size,shortcutDetails(targetId,targetMimeType))");
  sp.set("pageSize", "1000");
  sp.set("supportsAllDrives", "true");
  sp.set("includeItemsFromAllDrives", "true");
  if (params.pageToken) sp.set("pageToken", params.pageToken);

  // If using API key (public), include it. If OAuth, do not.
  if (params.apiKey) sp.set("key", params.apiKey);

  return `https://www.googleapis.com/drive/v3/files?${sp.toString()}`;
}

export async function publicDriveListChildren(params: {
  apiKey?: string;
  accessToken?: string;
  folderId: string;
}) {
  const files: DrivePublicFile[] = [];
  let pageToken: string | undefined;

  // Public folder listing should prefer API key when provided.
  // Using OAuth here can be surprisingly restrictive for link-shared items (can lead to partial/empty results).
  const useOAuth = Boolean(params.accessToken) && !params.apiKey;

  const q = `'${params.folderId}' in parents and trashed = false`;

  do {
    const url = buildListUrl({ apiKey: params.apiKey, q, pageToken, useOAuth });
    const res = await fetchWithTimeout(
      url,
      useOAuth
        ? {
            headers: {
              Authorization: `Bearer ${params.accessToken}`,
            },
          }
        : {},
      60_000,
    );

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Failed listing folder [${res.status}]: ${txt}`);
    }
    const data = (await res.json()) as { files?: DrivePublicFile[]; nextPageToken?: string };
    files.push(...(data.files || []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return files;
}

export async function publicDriveGetFileMetadata(params: {
  apiKey?: string;
  accessToken?: string;
  fileId: string;
}) {
  const sp = new URLSearchParams();
  sp.set("fields", "id,name,mimeType");
  sp.set("supportsAllDrives", "true");
  if (params.apiKey) sp.set("key", params.apiKey);

  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(params.fileId)}?${sp.toString()}`;

  const useOAuth = Boolean(params.accessToken) && !params.apiKey;
  const res = await fetchWithTimeout(
    url,
    useOAuth
      ? {
          headers: {
            Authorization: `Bearer ${params.accessToken}`,
          },
        }
      : {},
    30_000,
  );

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Failed getting file metadata [${res.status}]: ${txt}`);
  }

  return (await res.json()) as Pick<DrivePublicFile, "id" | "name" | "mimeType">;
}

function guessExportMime(mimeType: string) {
  // Handle Google Docs types
  if (mimeType === "application/vnd.google-apps.document") return { exportMime: "application/pdf", ext: ".pdf" };
  if (mimeType === "application/vnd.google-apps.spreadsheet")
    return { exportMime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ext: ".xlsx" };
  if (mimeType === "application/vnd.google-apps.presentation")
    return { exportMime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", ext: ".pptx" };
  return null;
}

export async function publicDriveDownloadFile(params: {
  fileId: string;
  mimeType: string;
  apiKey?: string;
  accessToken?: string;
}) {
  const exportInfo = guessExportMime(params.mimeType);

  const baseUrl = exportInfo
    ? `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(params.fileId)}/export?mimeType=${encodeURIComponent(exportInfo.exportMime)}`
    : `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(params.fileId)}?alt=media&acknowledgeAbuse=true`;

  const url = params.apiKey ? `${baseUrl}&key=${encodeURIComponent(params.apiKey)}` : baseUrl;

  const res = await fetchWithTimeout(
    url,
    params.accessToken
      ? {
          headers: {
            Authorization: `Bearer ${params.accessToken}`,
          },
        }
      : {},
    120_000,
  );

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Download failed [${res.status}]: ${txt}`);
  }
  const blob = await res.blob();

  return {
    blob,
    nameSuffix: exportInfo?.ext || "",
    contentType: exportInfo?.exportMime || blob.type || "application/octet-stream",
  };
}
