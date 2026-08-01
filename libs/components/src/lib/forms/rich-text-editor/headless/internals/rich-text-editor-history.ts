import { signal } from '@angular/core';

/**
 * A caret or selection as character offsets into the editor's text content. The only form that
 * survives a snapshot being restored: undo re-renders the editable from the value, so every node
 * the old range pointed at is gone by the time the caret has to go back.
 */
export type RichTextEditorSelectionOffsets = { start: number; end: number };

/** One undoable state: the canonical Markdown value plus where the caret sat in it. */
export type RichTextEditorHistoryEntry = {
  value: string;
  selection: RichTextEditorSelectionOffsets | null;
};

/** Typing keeps extending the newest entry as long as the next keystroke lands within this window. */
const COALESCE_WINDOW_MS = 500;

/** How many states are kept. The oldest fall off the bottom - enough depth to be useful, bounded
 *  so a long editing session can't grow the stack without limit. */
const MAX_ENTRIES = 100;

/**
 * The characters `next` inserted over `prev` - a prefix/suffix diff, which is all that is needed to
 * tell "typed a word character" from "typed a space". A deletion yields `''`.
 */
const insertedChunk = (prev: string, next: string) => {
  let start = 0;

  while (start < prev.length && start < next.length && prev[start] === next[start]) start++;

  let end = 0;

  while (
    end < prev.length - start &&
    end < next.length - start &&
    prev[prev.length - 1 - end] === next[next.length - 1 - end]
  ) {
    end++;
  }

  return next.slice(start, next.length - end);
};

/**
 * Snapshot history for the rich text editor: undo/redo over the canonical Markdown value rather
 * than over the DOM.
 *
 * The editor cannot use the browser's native `contenteditable` undo stack, because it rewrites the
 * DOM behind that stack's back - pasted HTML is normalized through the Markdown pipeline and
 * autoformat turns typed text into structure. Native undo would then restore a DOM state the value
 * model never had (or silently do nothing), so every edit is snapshotted here instead and the
 * platform's undo affordances are routed into this stack.
 *
 * Granularity: a burst of plain typing coalesces into one entry (per {@link COALESCE_WINDOW_MS},
 * and never across a whitespace character - so undo steps back word by word), while every
 * programmatic rewrite commits with `boundary: true` and is undone in a single step.
 */
export const createRichTextEditorHistory = () => {
  let entries: RichTextEditorHistoryEntry[] = [{ value: '', selection: null }];
  let index = 0;
  let lastCommitAt = 0;

  /** Whether the newest entry is an open typing burst the next commit may still extend. */
  let burstOpen = false;

  const canUndo = signal(false);
  const canRedo = signal(false);

  const syncFlags = () => {
    canUndo.set(index > 0);
    canRedo.set(index < entries.length - 1);
  };

  /** Keeps the current entry's caret up to date while the content doesn't change, so undoing an
   *  edit made after clicking elsewhere puts the caret back where the user actually was. */
  const recordSelection = (selection: RichTextEditorSelectionOffsets | null) => {
    const current = entries[index];

    if (current) current.selection = selection;
  };

  /**
   * Records the editor's state after an edit. `boundary` forces its own entry instead of extending
   * the running typing burst - what every programmatic rewrite (paste, autoformat, a tool, a token
   * insert) passes, so one undo takes the whole rewrite back.
   */
  const commit = ({ value, selection }: RichTextEditorHistoryEntry, boundary = false) => {
    const current = entries[index];

    if (!current) return;

    // An edit that didn't change the value (a no-op command, a re-sync) is only a caret move.
    if (current.value === value) {
      recordSelection(selection);

      return;
    }

    // Editing after an undo abandons the redo branch.
    if (index < entries.length - 1) entries = entries.slice(0, index + 1);

    const now = Date.now();
    // Typing extends the newest entry, except across a whitespace character - that starts the next
    // entry, so undo steps back word by word. (The whitespace usually rides along with the letter
    // after it: a trailing space alone is trimmed out of the Markdown value, so it commits nothing.)
    const crossedWhitespace = /\s/.test(insertedChunk(current.value, value));
    const extendBurst = !boundary && burstOpen && !crossedWhitespace && now - lastCommitAt < COALESCE_WINDOW_MS;

    // Anything but a programmatic rewrite leaves a burst the following keystrokes can join.
    burstOpen = !boundary;
    lastCommitAt = now;

    if (extendBurst) {
      entries[index] = { value, selection };
      syncFlags();

      return;
    }

    entries.push({ value, selection });

    if (entries.length > MAX_ENTRIES) entries.shift();

    index = entries.length - 1;
    syncFlags();
  };

  /** Restarts from `value` as the only state - for a value the editor didn't produce itself. */
  const reset = (value: string, selection: RichTextEditorSelectionOffsets | null = null) => {
    entries = [{ value, selection }];
    index = 0;
    burstOpen = false;
    syncFlags();
  };

  const step = (delta: number): RichTextEditorHistoryEntry | null => {
    const next = index + delta;
    const entry = next >= 0 && next < entries.length ? entries[next] : null;

    if (!entry) return null;

    index = next;
    // Undoing ends the typing burst: the next keystroke must not merge into the restored entry.
    burstOpen = false;
    syncFlags();

    return entry;
  };

  /** The state before the current one, or `null` at the bottom of the stack. */
  const undo = () => step(-1);

  /** The state after the current one, or `null` when nothing was undone. */
  const redo = () => step(1);

  return { canUndo, canRedo, commit, recordSelection, reset, undo, redo };
};

export type RichTextEditorHistory = ReturnType<typeof createRichTextEditorHistory>;
