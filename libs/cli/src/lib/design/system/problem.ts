/**
 * A rule hit; `at` is a stable place of it within its part (a control, a state, an action) for the rule baseline, and
 * `part` the part it is about when the file alone does not say.
 */
export type Problem = { rule: string; file: string; message: string; at?: string; part?: string };
