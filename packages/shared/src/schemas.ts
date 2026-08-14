import { z } from 'zod';
import { MAX_BIO_LENGTH, MAX_DISPLAY_NAME_LENGTH, MIN_AGE_YEARS } from './constants';
import { AvatarType } from './enums';

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters');

const dateOfBirthSchema = z.coerce.date().refine((date) => {
  const today = new Date();
  const minBirthDate = new Date(
    today.getFullYear() - MIN_AGE_YEARS,
    today.getMonth(),
    today.getDate(),
  );
  return date <= minBirthDate;
}, `You must be at least ${MIN_AGE_YEARS} years old`);

export const SignUpSchema = z
  .object({
    email: z.string().email().optional(),
    phone: z
      .string()
      .regex(/^\+[1-9]\d{6,14}$/, 'Phone must be in E.164 format')
      .optional(),
    password: passwordSchema,
    dateOfBirth: dateOfBirthSchema,
    displayName: z.string().min(1).max(MAX_DISPLAY_NAME_LENGTH).optional(),
  })
  .refine((data) => data.email || data.phone, {
    message: 'Either email or phone is required',
    path: ['email'],
  });

export const LoginSchema = z
  .object({
    email: z.string().email().optional(),
    phone: z
      .string()
      .regex(/^\+[1-9]\d{6,14}$/)
      .optional(),
    password: passwordSchema,
  })
  .refine((data) => data.email || data.phone, {
    message: 'Either email or phone is required',
    path: ['email'],
  });

export const UpdateProfileSchema = z.object({
  displayName: z.string().min(1).max(MAX_DISPLAY_NAME_LENGTH).optional(),
  bio: z.string().max(MAX_BIO_LENGTH).optional(),
  avatarType: z.nativeEnum(AvatarType).optional(),
  dateOfBirth: dateOfBirthSchema.optional(),
  avatarTheme: z.enum(['aurora', 'sunset', 'midnight', 'forest']).optional(),
});

export const UpdateSettingsSchema = z.object({
  radiusMeters: z.number().int().min(150).max(500).optional(),
  quietMode: z.boolean().optional(),
  showDistanceBucket: z.boolean().optional(),
  allowPushReplies: z.boolean().optional(),
  allowPushChat: z.boolean().optional(),
  allowPushIcebreaker: z.boolean().optional(),
  showReadReceipts: z.boolean().optional(),
  language: z.string().min(2).max(10).optional(),
});

export const VerifyOtpSchema = z.object({
  code: z.string().length(6, 'Code must be 6 digits'),
});

export const ForgotPasswordSchema = z
  .object({
    email: z.string().email().optional(),
    phone: z.string().regex(/^\+[1-9]\d{6,14}$/).optional(),
  })
  .refine((data) => data.email || data.phone, {
    message: 'Either email or phone is required',
    path: ['email'],
  });

export const ResetPasswordSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});

export type SignUpInput = z.infer<typeof SignUpSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
export type UpdateSettingsInput = z.infer<typeof UpdateSettingsSchema>;
export type VerifyOtpInput = z.infer<typeof VerifyOtpSchema>;
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;

export const CreateWallPostSchema = z.object({
  content: z.string().min(1).max(500),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().positive().optional(),
});

export const CreateWallReplySchema = z.object({
  content: z.string().min(1).max(300),
});

export const PresencePingSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().positive().optional(),
});

export const SetAvailableSchema = z.object({
  isAvailable: z.boolean(),
});

export const MediaPresignSchema = z.object({
  fileName: z.string().min(1).max(255),
  contentType: z.string().regex(/^image\//, 'Content type must be an image'),
});

export const MediaConfirmSchema = z.object({
  key: z.string().min(1),
});

export type CreateWallPostInput = z.infer<typeof CreateWallPostSchema>;
export type CreateWallReplyInput = z.infer<typeof CreateWallReplySchema>;
export type PresencePingInput = z.infer<typeof PresencePingSchema>;
export type SetAvailableInput = z.infer<typeof SetAvailableSchema>;
export type MediaPresignInput = z.infer<typeof MediaPresignSchema>;
export type MediaConfirmInput = z.infer<typeof MediaConfirmSchema>;

export const MatchRequestSchema = z.object({
  source: z.enum(['wall_reply', 'manual']),
  sourceReferenceId: z.string().uuid(),
});

export const SendMessageSchema = z.object({
  content: z.string().min(1).max(2000),
});

export const BlockUserSchema = z.object({
  userId: z.string().uuid(),
});

export const CreateReportSchema = z.object({
  reportedUserId: z.string().uuid(),
  targetType: z.enum(['user', 'post', 'reply', 'message']),
  targetId: z.string().uuid(),
  reason: z.enum(['harassment', 'spam', 'inappropriate', 'underage', 'other']),
  description: z.string().max(1000).optional(),
});

export type MatchRequestInput = z.infer<typeof MatchRequestSchema>;
export type SendMessageInput = z.infer<typeof SendMessageSchema>;
export type BlockUserInput = z.infer<typeof BlockUserSchema>;
export type CreateReportInput = z.infer<typeof CreateReportSchema>;
