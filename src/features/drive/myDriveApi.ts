import { fetchWithTimeout } from "@/features/drive/cloneUtils";

export async function myDriveCreateFolder(params: { accessToken: string; name: string; parentId?: string }) {
  const metadata = {
    name: params.name,
    mimeType: "application/vnd.google-apps.folder",
    ...(params.parentId ? { parents: [params.parentId] } : {}),
  };

  const res = await fetchWithTimeout(
    "https://www.googleapis.com/drive/v3/files?supportsAllDrives=true",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(metadata),
    },
    60_000,
  );

  const data = await res.json();
  if (!res.ok) throw new Error(`Create folder failed [${res.status}]: ${JSON.stringify(data)}`);
  return data as { id: string };
}

export async function myDriveCopyFile(params: {
  accessToken: string;
  sourceFileId: string;
  name: string;
  parentId?: string;
}) {
  const body = {
    name: params.name,
    ...(params.parentId ? { parents: [params.parentId] } : {}),
  };

  const res = await fetchWithTimeout(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(params.sourceFileId)}/copy?supportsAllDrives=true`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
    60_000,
  );

  const data = await res.json();
  if (!res.ok) throw new Error(`Copy failed [${res.status}]: ${JSON.stringify(data)}`);
  return data as { id: string };
}

export async function myDriveUploadFile(params: {
  accessToken: string;
  name: string;
  parentId?: string;
  blob: Blob;
  contentType: string;
}) {
  const metadata = {
    name: params.name,
    ...(params.parentId ? { parents: [params.parentId] } : {}),
  };

  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  form.append("file", params.blob, params.name);

  const res = await fetchWithTimeout(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
      },
      body: form,
    },
    120_000,
  );

  const data = await res.json();
  if (!res.ok) throw new Error(`Upload failed [${res.status}]: ${JSON.stringify(data)}`);
  return data as { id: string };
}
