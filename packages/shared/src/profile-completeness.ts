export type ProfileCompletenessField =
  | 'photo'
  | 'bio'
  | 'gender'
  | 'liveness'
  | 'contact';

export interface ProfileCompletenessInput {
  avatarUrl?: string | null;
  bio?: string | null;
  gender?: string | null;
  livenessVerified?: boolean;
  emailVerified?: boolean;
  phoneVerified?: boolean;
}

export interface ProfileCompletenessItem {
  id: ProfileCompletenessField;
  label: string;
  complete: boolean;
}

export interface ProfileCompletenessResult {
  percent: number;
  isComplete: boolean;
  items: ProfileCompletenessItem[];
  nextItem: ProfileCompletenessItem | null;
}

const FIELD_DEFINITIONS: Array<{
  id: ProfileCompletenessField;
  label: string;
  isComplete: (input: ProfileCompletenessInput) => boolean;
}> = [
  {
    id: 'photo',
    label: 'Add a profile photo',
    isComplete: (input) => Boolean(input.avatarUrl?.trim()),
  },
  {
    id: 'bio',
    label: 'Write a short bio',
    isComplete: (input) => Boolean(input.bio?.trim()),
  },
  {
    id: 'gender',
    label: 'Confirm your gender',
    isComplete: (input) => Boolean(input.gender),
  },
  {
    id: 'liveness',
    label: 'Complete liveness verification',
    isComplete: (input) => input.livenessVerified === true,
  },
  {
    id: 'contact',
    label: 'Verify your email or phone',
    isComplete: (input) => input.emailVerified === true || input.phoneVerified === true,
  },
];

export function getProfileCompleteness(input: ProfileCompletenessInput): ProfileCompletenessResult {
  const items = FIELD_DEFINITIONS.map((field) => ({
    id: field.id,
    label: field.label,
    complete: field.isComplete(input),
  }));

  const completedCount = items.filter((item) => item.complete).length;
  const percent =
    items.length === 0 ? 100 : Math.round((completedCount / items.length) * 100);
  const nextItem = items.find((item) => !item.complete) ?? null;

  return {
    percent,
    isComplete: percent === 100,
    items,
    nextItem,
  };
}
