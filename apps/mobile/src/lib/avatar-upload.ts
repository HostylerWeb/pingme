import { api, ApiError, uploadAvatarFile } from './api';

type PresignResponse = {
  success: boolean;
  data: {
    uploadUrl: string | null;
    key: string;
    directUpload?: boolean;
    message?: string;
  };
};

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function uploadViaPresignedUrl(uploadUrl: string, uri: string) {
  const response = await fetch(uri);
  const blob = await response.blob();
  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/jpeg' },
    body: blob,
  });

  if (!uploadResponse.ok) {
    throw new Error('Avatar upload failed');
  }
}

async function uploadDirectBase64(key: string, uri: string) {
  const fileResponse = await fetch(uri);
  const arrayBuffer = await fileResponse.arrayBuffer();
  const data = arrayBufferToBase64(arrayBuffer);

  await api.uploadAvatarBase64({
    key,
    contentType: 'image/jpeg',
    data,
  });
}

async function uploadDirect(key: string, uri: string, fileName: string) {
  try {
    await uploadAvatarFile(key, uri, fileName);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      await uploadDirectBase64(key, uri);
      return;
    }

    try {
      await uploadDirectBase64(key, uri);
    } catch (fallbackError) {
      throw error instanceof ApiError ? error : fallbackError;
    }
  }
}

export async function uploadAvatarFromUri(uri: string) {
  const fileName = uri.split('/').pop() ?? 'avatar.jpg';
  const presign = (await api.presignAvatar({
    fileName,
    contentType: 'image/jpeg',
  })) as PresignResponse;

  const { uploadUrl, key, directUpload } = presign.data;

  if (directUpload || !uploadUrl) {
    await uploadDirect(key, uri, fileName);
    return;
  }

  await uploadViaPresignedUrl(uploadUrl, uri);
  await api.confirmAvatar({ key });
}
