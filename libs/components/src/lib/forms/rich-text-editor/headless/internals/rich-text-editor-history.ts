import { signal } from '@angular/core';

/**
 * Character offsets are the only form that survives a snapshot being restored: undo re-renders the
 * editable from the value, so every node a stored `Range` pointed at is gone by then.
 */
export type RichTextEditorSelectionOffsets = { start: number; end: number };

export type RichTextEditorHistoryEntry = {
  value: string;
  selection: RichTextEditorSelectionOffsets | null;
};

const COALESCE_WINDOW_MS = 500;

const MAX_ENTRIES = 100;

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
 * The editor cannot use the browser's native `contenteditable` undo stack: it rewrites the DOM
 * behind that stack's back (paste is normalized through the Markdown pipeline, autoformat turns
 * typed text into structure), so native undo would restore a DOM state the value model never had.
 */
export const createRichTextEditorHistory = () => {
  let entries: RichTextEditorHistoryEntry[] = [{ value: '', selection: null }];
  let index = 0;
  let lastCommitAt = 0;

  let burstOpen = false;

  const canUndo = signal(false);
  const canRedo = signal(false);

  const syncFlags = () => {
    canUndo.set(index > 0);
    canRedo.set(index < entries.length - 1);
  };

  const recordSelection = (selection: RichTextEditorSelectionOffsets | null) => {
    const current = entries[index];

    if (current) current.selection = selection;
  };

  const commit = ({ value, selection }: RichTextEditorHistoryEntry, boundary = false) => {
    const current = entries[index];

    if (!current) return;

    if (current.value === value) {
      recordSelection(selection);

      return;
    }

    if (index < entries.length - 1) entries = entries.slice(0, index + 1);

    const now = Date.now();
    const crossedWhitespace = /\s/.test(insertedChunk(current.value, value));
    const extendBurst = !boundary && burstOpen && !crossedWhitespace && now - lastCommitAt < COALESCE_WINDOW_MS;

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
    burstOpen = false;
    syncFlags();

    return entry;
  };

  const undo = () => step(-1);

  const redo = () => step(1);

  return { canUndo, canRedo, commit, recordSelection, reset, undo, redo };
};

export type RichTextEditorHistory = ReturnType<typeof createRichTextEditorHistory>;
