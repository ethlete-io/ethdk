const ACKNOWLEDGEMENT =
  /^(?:(?:ok(?:ay)?|yes|yep|yeah|sure|agreed?|sounds (?:good|great|fine)|go(?: on| ahead)?|continue|proceed|next|thanks?|thank you|lgtm|perfect|great|nice|good|fine|do it|ja|jo|passt|weiter|mach weiter|einverstanden)\s*)+$/;
const NEXT_STEP_QUESTION =
  /^(?:where|what|how) (?:do|should|shall|can|will) we (?:continue|go|proceed|pick up|go on)\b/;

/** A prompt that only agrees or asks what comes next: it names the conversation, never the work. */
export const isAcknowledgement = (note: string) => {
  const plain = note
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return !plain || ACKNOWLEDGEMENT.test(plain) || NEXT_STEP_QUESTION.test(plain);
};

const MIN_WORDS = 2;
const WORD = /\p{L}{2,}/gu;
const LETTER = /\p{L}/gu;

/** Whether a summary reads as words: at least two words of two letters, and letters for half of what is not space. */
export const isReadableSummary = (summary: string) => {
  const visible = summary.replace(/\s+/g, '');

  if (!visible) return false;

  const words = summary.match(WORD)?.length ?? 0;
  const letters = visible.match(LETTER)?.length ?? 0;

  return words >= MIN_WORDS && letters * 2 >= visible.length;
};
