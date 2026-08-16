import { create } from 'zustand';

interface IcebreakerNearbyPromptState {
  nearbyCount: number | null;
  setNearbyPrompt: (count: number) => void;
  clearNearbyPrompt: () => void;
}

export const useIcebreakerNearbyPromptStore = create<IcebreakerNearbyPromptState>((set) => ({
  nearbyCount: null,
  setNearbyPrompt: (count) => set({ nearbyCount: Math.max(1, count) }),
  clearNearbyPrompt: () => set({ nearbyCount: null }),
}));

export function setIcebreakerNearbyPrompt(count: number) {
  useIcebreakerNearbyPromptStore.getState().setNearbyPrompt(count);
}

export function clearIcebreakerNearbyPrompt() {
  useIcebreakerNearbyPromptStore.getState().clearNearbyPrompt();
}
