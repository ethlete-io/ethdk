/** A rule hit; `at` is a stable place of it within its part (a control, a state, an action) for the rule baseline. */
export type Problem = { rule: string; file: string; message: string; at?: string };
