import { api } from './api';
import { readUriAsBase64, uploadViaPresignedUrl } from './media-upload';

export async function uploadEventImageFromUri(eventId: string, uri: string) {
  const fileName = uri.split('/').pop() ?? 'event.jpg';
  const contentType = 'image/jpeg';
  const presign = await api.presignEventImage(eventId, fileName, contentType);
  const { uploadUrl, key, publicUrl, directUpload } = presign.data;

  if (directUpload || !uploadUrl) {
    const data = await readUriAsBase64(uri);
    await api.uploadEventImageBase64(eventId, { key, contentType, data });
    return publicUrl;
  }

  await uploadViaPresignedUrl(uploadUrl, uri, contentType);
  return publicUrl;
}
