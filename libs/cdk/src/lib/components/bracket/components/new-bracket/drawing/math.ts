export type BracketPosition = {
  inline: { start: number; end: number; center: number }; // the left, right and center of the match
  block: { start: number; end: number; center: number }; // the top, bottom and center of the match
};
