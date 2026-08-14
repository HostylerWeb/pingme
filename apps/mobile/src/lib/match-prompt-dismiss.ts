const dismissedMatchIds = new Set<string>();

export function dismissMatchPrompt(matchId: string) {
  dismissedMatchIds.add(matchId);
}

export function isMatchPromptDismissed(matchId: string) {
  return dismissedMatchIds.has(matchId);
}

export function clearDismissedMatchPrompt(matchId: string) {
  dismissedMatchIds.delete(matchId);
}
