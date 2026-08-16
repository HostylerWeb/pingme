export const EVENT_RSVP_WITHDRAWAL_REASONS = [
  {
    code: 'schedule_conflict',
    label: "I can't make it / my schedule changed",
  },
  {
    code: 'lost_interest',
    label: "I'm no longer interested",
  },
  {
    code: 'other',
    label: 'Other',
  },
] as const;

export type EventRsvpWithdrawalReasonCode =
  (typeof EVENT_RSVP_WITHDRAWAL_REASONS)[number]['code'];

export function eventRsvpWithdrawalReasonLabel(code: string): string {
  return (
    EVENT_RSVP_WITHDRAWAL_REASONS.find((reason) => reason.code === code)?.label ?? code
  );
}
