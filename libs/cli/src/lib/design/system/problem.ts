/**
 * A rule hit; `at` is a stable place of it within its part (a control, a state, an action) for the rule baseline,
 * `part` the part it is about when the file alone does not say, and `states` the states of that part it is about,
 * which the rule baseline ignores.
 */
export type Problem = {
  rule: string;
  file: string;
  message: string;
  at?: string;
  part?: string;
  states?: string[];
  /** On a `STATE-UNDESIGNED` hit: the state whose props take the branch, for the sketch of the built look (B251b). */
  missing?: { state: string; props: Record<string, unknown> };
};
