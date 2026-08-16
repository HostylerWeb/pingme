import { z } from 'zod';
import { MAX_BIO_LENGTH, MAX_DISPLAY_NAME_LENGTH, MIN_AGE_YEARS, GENDER_OPTIONS } from './constants';
import { AvatarType } from './enums';

const genderSchema = z.enum(GENDER_OPTIONS.map((option) => option.value) as [
  'male',
  'female',
  'transgender',
  'other',
]);

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters');

const strongPasswordSchema = passwordSchema.regex(
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/,
  'Password must include upper and lower case letters and a number',
);

/** Trim + lowercase so login/register/reset cannot create case-variant duplicates. */
const normalizedEmailSchema = z
  .string()
  .trim()
  .email()
  .transform((email) => email.toLowerCase());

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
    email: normalizedEmailSchema.optional(),
    phone: z
      .string()
      .regex(/^\+[1-9]\d{6,14}$/, 'Phone must be in E.164 format')
      .optional(),
    password: strongPasswordSchema,
    dateOfBirth: dateOfBirthSchema,
    gender: genderSchema,
    displayName: z.string().min(1).max(MAX_DISPLAY_NAME_LENGTH).optional(),
  })
  .strict()
  .refine((data) => data.email || data.phone, {
    message: 'Either email or phone is required',
    path: ['email'],
  });

export const LoginSchema = z
  .object({
    email: normalizedEmailSchema.optional(),
    phone: z
      .string()
      .regex(/^\+[1-9]\d{6,14}$/)
      .optional(),
    password: passwordSchema,
  })
  .strict()
  .refine((data) => data.email || data.phone, {
    message: 'Either email or phone is required',
    path: ['email'],
  });

export const UpdateProfileSchema = z
  .object({
    displayName: z.string().min(1).max(MAX_DISPLAY_NAME_LENGTH).optional(),
    bio: z.string().max(MAX_BIO_LENGTH).optional(),
    avatarType: z.nativeEnum(AvatarType).optional(),
    dateOfBirth: dateOfBirthSchema.optional(),
    gender: genderSchema.optional(),
    avatarTheme: z.enum(['aurora', 'sunset', 'midnight', 'forest']).optional(),
  })
  .strict();

export const UpdateSettingsSchema = z
  .object({
    radiusMeters: z.number().int().min(1).max(100_000).optional(),
    quietMode: z.boolean().optional(),
    showDistanceBucket: z.boolean().optional(),
    allowPushReplies: z.boolean().optional(),
    allowPushChat: z.boolean().optional(),
    allowPushIcebreaker: z.boolean().optional(),
    allowPushIcebreakerNearby: z.boolean().optional(),
    allowPushEventsNearby: z.boolean().optional(),
    showReadReceipts: z.boolean().optional(),
    language: z.string().min(2).max(10).optional(),
  })
  .strict();

export const VerifyOtpSchema = z
  .object({
    code: z.string().length(6, 'Code must be 6 digits'),
  })
  .strict();

export const ForgotPasswordSchema = z
  .object({
    email: normalizedEmailSchema.optional(),
    phone: z.string().regex(/^\+[1-9]\d{6,14}$/).optional(),
  })
  .strict()
  .refine((data) => data.email || data.phone, {
    message: 'Either email or phone is required',
    path: ['email'],
  });

export const ResetPasswordSchema = z
  .object({
    token: z.string().min(1),
    password: strongPasswordSchema,
  })
  .strict();

export const DeleteAccountSchema = z
  .object({
    password: z.string().min(1, 'Password is required'),
    confirmation: z.literal('DELETE', {
      errorMap: () => ({ message: 'Type DELETE to confirm' }),
    }),
  })
  .strict();

export const CancelAccountDeletionSchema = z
  .object({
    password: z.string().min(1, 'Password is required'),
  })
  .strict();

export type SignUpInput = z.infer<typeof SignUpSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
export type UpdateSettingsInput = z.infer<typeof UpdateSettingsSchema>;
export type VerifyOtpInput = z.infer<typeof VerifyOtpSchema>;
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
export type DeleteAccountInput = z.infer<typeof DeleteAccountSchema>;
export type CancelAccountDeletionInput = z.infer<typeof CancelAccountDeletionSchema>;

export const CreateWallPostSchema = z.object({
  content: z.string().min(1).max(500),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().positive().optional(),
  showPhoto: z.boolean().optional(),
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

export const MediaUploadBase64Schema = z.object({
  key: z.string().min(1),
  contentType: z.string().regex(/^image\//, 'Content type must be an image'),
  data: z.string().min(1),
});

export const RegisterDeviceSchema = z.object({
  platform: z.enum(['ios', 'android']),
  pushToken: z.string().min(10),
  deviceId: z.string().optional(),
  deviceModel: z.string().max(120).optional(),
  osVersion: z.string().max(40).optional(),
  userAgent: z.string().max(500).optional(),
  appVersion: z.string().max(40).optional(),
});

export const UnregisterDeviceSchema = z.object({
  pushToken: z.string().min(10),
});

export type CreateWallPostInput = z.infer<typeof CreateWallPostSchema>;
export type CreateWallReplyInput = z.infer<typeof CreateWallReplySchema>;
export type PresencePingInput = z.infer<typeof PresencePingSchema>;
export type SetAvailableInput = z.infer<typeof SetAvailableSchema>;
export type MediaPresignInput = z.infer<typeof MediaPresignSchema>;
export type MediaConfirmInput = z.infer<typeof MediaConfirmSchema>;
export type MediaUploadBase64Input = z.infer<typeof MediaUploadBase64Schema>;
export type RegisterDeviceInput = z.infer<typeof RegisterDeviceSchema>;
export type UnregisterDeviceInput = z.infer<typeof UnregisterDeviceSchema>;

export const MatchRequestSchema = z
  .object({
    source: z.enum(['wall_reply', 'manual']),
    sourceReferenceId: z.string().uuid(),
    reasonCode: z.enum(['shared_interest', 'meet_up', 'continue_conversation', 'other']),
    reasonDetail: z.string().max(500).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.reasonCode === 'other' && !data.reasonDetail?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Please tell them why you want to connect',
        path: ['reasonDetail'],
      });
    }
  });

export const SendMessageSchema = z.object({
  content: z.string().min(1).max(2000),
});

export const BlockUserSchema = z.object({
  userId: z.string().uuid(),
});

export const CreateReportSchema = z.object({
  reportedUserId: z.string().uuid(),
  targetType: z.enum(['user', 'post', 'reply', 'message', 'event', 'event_comment']),
  targetId: z.string().uuid(),
  reason: z.enum(['harassment', 'spam', 'inappropriate', 'underage', 'other']),
  description: z.string().max(1000).optional(),
});

export const CreateEventSchema = z
  .object({
    title: z.string().min(1).max(120),
    description: z.string().min(1).max(5000),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    placeName: z.string().max(200).optional(),
    address: z.string().max(500).optional(),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    allowMessages: z.boolean().optional(),
  })
  .refine((data) => data.endsAt > data.startsAt, {
    message: 'End time must be after start time',
    path: ['endsAt'],
  });

export const UpdateEventSchema = z
  .object({
    title: z.string().min(1).max(120).optional(),
    description: z.string().min(1).max(5000).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    placeName: z.string().max(200).nullable().optional(),
    address: z.string().max(500).nullable().optional(),
    startsAt: z.coerce.date().optional(),
    endsAt: z.coerce.date().optional(),
    allowMessages: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (data.startsAt && data.endsAt) {
        return data.endsAt > data.startsAt;
      }
      return true;
    },
    { message: 'End time must be after start time', path: ['endsAt'] },
  );

export const EventRsvpSchema = z.object({
  status: z.enum(['going', 'maybe']),
});

export const EventRsvpWithdrawSchema = z
  .object({
    reasonCode: z.enum(['schedule_conflict', 'lost_interest', 'other']),
    reasonDetail: z.string().max(500).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.reasonCode === 'other' && !data.reasonDetail?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Please tell us a bit more',
        path: ['reasonDetail'],
      });
    }
  });

export const CreateEventCommentSchema = z.object({
  content: z.string().min(1).max(500),
  parentId: z.string().uuid().optional(),
});

export const MessageEventHostSchema = z.object({
  message: z.string().max(2000).optional(),
});

export const EventImageConfirmSchema = z.object({
  images: z
    .array(
      z.object({
        url: z.string().url().max(500),
        isCover: z.boolean().optional(),
        sortOrder: z.number().int().min(0).max(4).optional(),
      }),
    )
    .min(1)
    .max(5),
});

export type MatchRequestInput = z.infer<typeof MatchRequestSchema>;
export type SendMessageInput = z.infer<typeof SendMessageSchema>;
export type BlockUserInput = z.infer<typeof BlockUserSchema>;
export type CreateReportInput = z.infer<typeof CreateReportSchema>;
export type CreateEventInput = z.infer<typeof CreateEventSchema>;
export type UpdateEventInput = z.infer<typeof UpdateEventSchema>;
export type EventRsvpInput = z.infer<typeof EventRsvpSchema>;
export type EventRsvpWithdrawInput = z.infer<typeof EventRsvpWithdrawSchema>;
export type CreateEventCommentInput = z.infer<typeof CreateEventCommentSchema>;
export type MessageEventHostInput = z.infer<typeof MessageEventHostSchema>;
export type EventImageConfirmInput = z.infer<typeof EventImageConfirmSchema>;
