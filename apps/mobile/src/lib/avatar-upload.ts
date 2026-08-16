import { api } from './api';
import { uploadDirectMedia, uploadViaPresignedUrl } from './media-upload';

type PresignResponse = {
  success: boolean;
  data: {
    uploadUrl: string | null;
    key: string;
    directUpload?: boolean;
    message?: string;
  };
};

export async function uploadAvatarFromUri(uri: string) {
  const fileName = uri.split('/').pop() ?? 'avatar.jpg';
  const contentType = 'image/jpeg';
  const presign = (await api.presignAvatar({
    fileName,
    contentType,
  })) as PresignResponse;

  const { uploadUrl, key, directUpload } = presign.data;

  if (directUpload || !uploadUrl) {
    await uploadDirectMedia(key, uri, fileName, contentType);
    return;
  }

  await uploadViaPresignedUrl(uploadUrl, uri, contentType);
  await api.confirmAvatar({ key });
}
