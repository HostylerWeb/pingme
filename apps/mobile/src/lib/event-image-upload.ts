import { api, uploadAvatarFile } from './api';

export async function uploadEventImageFromUri(eventId: string, uri: string) {
  const fileName = uri.split('/').pop() ?? 'event.jpg';
  const presign = await api.presignEventImage(eventId, fileName, 'image/jpeg');
  const { uploadUrl, key, publicUrl, directUpload } = presign.data;

  if (directUpload || !uploadUrl) {
    await uploadAvatarFile(key, uri, fileName);
    return publicUrl;
  }

  const response = await fetch(uri);
  const blob = await response.blob();
  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/jpeg' },
    body: blob,
  });

  if (!uploadResponse.ok) {
    throw new Error('Image upload failed');
  }

  return publicUrl;
}
