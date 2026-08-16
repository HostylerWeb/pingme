export const WALL_CONNECT_REASONS = [
  {
    code: 'shared_interest',
    label: 'We seem to have something in common',
  },
  {
    code: 'meet_up',
    label: "I'd like to meet up nearby",
  },
  {
    code: 'continue_conversation',
    label: 'I want to continue this conversation',
  },
  {
    code: 'other',
    label: 'Other',
  },
] as const;

export type WallConnectReasonCode = (typeof WALL_CONNECT_REASONS)[number]['code'];

export function wallConnectReasonLabel(code: string): string {
  return WALL_CONNECT_REASONS.find((reason) => reason.code === code)?.label ?? code;
}
