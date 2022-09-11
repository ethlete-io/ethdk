export const enum BottomSheetState {
  OPEN,
  CLOSING,
  CLOSED,
}

export type BottomSheetAutoFocusTarget = 'dialog' | 'first-tabbable' | 'first-heading';

export interface LegacyBottomSheetAnimationEvent {
  state: 'opened' | 'opening' | 'closing' | 'closed';
  totalTime: number;
}
