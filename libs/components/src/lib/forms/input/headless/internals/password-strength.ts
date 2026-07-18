const CHARACTER_CLASSES = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/];

/**
 * A deliberately simple zero-dependency strength score (0–4) from length and
 * character-class diversity. It is a typing-feedback heuristic, not a security
 * estimate — real policies (and dictionary checks à la zxcvbn) belong to the
 * schema/backend.
 */
export const scorePasswordStrength = (password: string) => {
  if (!password.length) {
    return 0;
  }

  const classes = CHARACTER_CLASSES.filter((pattern) => pattern.test(password)).length;
  let score = 0;

  if (password.length >= 8) {
    score += 1;
  }

  if (password.length >= 12) {
    score += 1;
  }

  if (classes >= 2) {
    score += 1;
  }

  if (classes >= 4 || (classes >= 3 && password.length >= 10)) {
    score += 1;
  }

  return score;
};
