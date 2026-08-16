import { api } from './api';

export function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export async function readUriAsBase64(uri: string) {
  const fileResponse = await fetch(uri);
  const arrayBuffer = await fileResponse.arrayBuffer();
  return arrayBufferToBase64(arrayBuffer);
}

export async function uploadViaPresignedUrl(uploadUrl: string, uri: string, contentType: string) {
  const response = await fetch(uri);
  const blob = await response.blob();
  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: blob,
  });

  if (!uploadResponse.ok) {
    throw new Error('Upload failed');
  }
}

export async function uploadDirectBase64(key: string, uri: string, contentType: string) {
  const data = await readUriAsBase64(uri);
  await api.uploadAvatarBase64({
    key,
    contentType,
    data,
  });
}

/** Direct server upload via base64 (RN new architecture does not support multipart FormData). */
export async function uploadDirectMedia(
  key: string,
  uri: string,
  _fileName: string,
  contentType = 'image/jpeg',
) {
  await uploadDirectBase64(key, uri, contentType);
}
