/** An issue the day already knows about, offered so the provider chooses rather than invents. */
export type ReasoningCandidate = {
  issueKey: string;
  /** What the day logged against it, or the issue's own summary. One line. */
  summary: string;
};

/**
 * One unnamed context as the provider sees it. Every field here is safe to send: a repository's
 * name rather than its path, a branch name, an application id, and wording the day's own evidence
 * already lends to a worklog description.
 */
export type ReasoningContext = {
  /** A token — `c1`, `c2` — never a `contextKey`, which carries the absolute repository path. */
  id: string;
  repo?: string;
  branch?: string;
  app?: string;
  minutes: number;
  notes: string[];
};

/** Exactly what leaves the machine. The review UI shows this document before anything is sent. */
export type ReasoningRequest = {
  candidates: ReasoningCandidate[];
  contexts: ReasoningContext[];
};

/** The request plus the map that turns an answer back into an attribution on this machine. */
export type ReasoningPlan = {
  request: ReasoningRequest;
  /** `c1` → the `UnnamedContext.id` it stands for. */
  contextIds: Record<string, string>;
  /** Identifies the request, so re-opening a day reads the cached answer instead of spawning a CLI. */
  hash: string;
};

/**
 * The agent CLIs that may be spawned. It mirrors `ALLOWED_COMMANDS` in `src-tauri/src/process.rs`,
 * which is the boundary that actually enforces it — this copy is what keeps a settings document from
 * offering a command the host will only reject.
 */
export const REASONING_COMMANDS = ['claude', 'codex'];

export type ReasoningOptions = {
  /** The agent CLI on the user's PATH. The host allows `claude` and `codex` and nothing else. */
  command: string;
  /**
   * A model alias or full name. Empty is the default and means the CLI decides, which is the model
   * the user already chose for it — naming one here is for a user who wants this one call cheaper.
   */
  model: string;
  timeoutMs: number;
};

export const DEFAULT_REASONING_OPTIONS: ReasoningOptions = {
  command: 'claude',
  model: '',
  timeoutMs: 120_000,
};

/**
 * How little observed time still deserves a question. A three-minute stray context is noise, and
 * every one of them costs prompt the answers that matter have to compete with.
 */
export const DEFAULT_MIN_REASONING_MS = 5 * 60_000;

/** How many notes one context contributes. Enough to recognise the work, short enough to stay cheap. */
export const DEFAULT_MAX_NOTES_PER_CONTEXT = 6;
