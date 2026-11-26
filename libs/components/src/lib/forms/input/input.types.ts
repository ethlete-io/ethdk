export const INPUT_TEXT_ALIGNMENTS = {
  START: 'start',
  CENTER: 'center',
  END: 'end',
} as const;

export type InputTextAlignment = (typeof INPUT_TEXT_ALIGNMENTS)[keyof typeof INPUT_TEXT_ALIGNMENTS];
