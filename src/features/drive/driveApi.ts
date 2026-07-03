export type DriveFileItem = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
  thumbnailLink?: string;
  webViewLink?: string;
};

export async function driveListFiles(params: {
  accessToken: string;
  q: string;
  fields?: string;
  pageSize?: number;
}) {
  const sp = new URLSearchParams();
  sp.set("q", params.q);
  sp.set("pageSize", String(params.pageSize ?? 100));
  sp.set("fields", params.fields ?? "files(id,name,mimeType,modifiedTime,size,thumbnailLink,webViewLink)");

  const res = await fetch(`https://www.googleapis.com/drive/v3/files?${sp.toString()}`, {
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Drive list failed [${res.status}]: ${JSON.stringify(data)}`);
  }

  return data as { files: DriveFileItem[] };
}

export async function driveDeleteFile(params: { accessToken: string; fileId: string }) {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${params.fileId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
    },
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Drive delete failed [${res.status}]: ${txt}`);
  }
}

export async function driveUploadFile(params: {
  accessToken: string;
  file: File;
  parentId?: string;
  nameOverride?: string;
}) {
  const metadata = {
    name: params.nameOverride ?? params.file.name,
    ...(params.parentId ? { parents: [params.parentId] } : {}),
  };

  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  form.append("file", params.file, params.file.name);

  const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
    },
    body: form,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Drive upload failed [${res.status}]: ${JSON.stringify(data)}`);
  }

  return data as { id: string; name: string };
}
