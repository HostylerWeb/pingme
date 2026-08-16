import { api, ApiError } from './api';

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
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
  const fileResponse = await fetch(uri);
  const arrayBuffer = await fileResponse.arrayBuffer();
  const data = arrayBufferToBase64(arrayBuffer);

  await api.uploadAvatarBase64({
    key,
    contentType,
    data,
  });
}

/** Direct server upload — base64 first to avoid RN FormData issues on new architecture. */
export async function uploadDirectMedia(
  key: string,
  uri: string,
  fileName: string,
  contentType = 'image/jpeg',
) {
  try {
    await uploadDirectBase64(key, uri, contentType);
    return;
  } catch {
    // Fall back to multipart for older clients.
  }

  const accessToken = await import('./auth-storage').then((m) => m.getAccessToken());
  const formData = new FormData();
  formData.append('key', key);
  formData.append('file', {
    uri,
    name: fileName,
    type: contentType,
  } as unknown as Blob);

  const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/v1';
  const response = await fetch(`${API_URL}/media/upload`, {
    method: 'POST',
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    body: formData,
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(
      body?.error?.message ?? body?.message ?? 'Upload failed',
      response.status,
      body?.error?.code ?? body?.code,
    );
  }
}
