import { createRichTextEditorHistory } from './rich-text-editor-history';

describe('createRichTextEditorHistory', () => {
  it('starts with nothing to undo or redo', () => {
    const history = createRichTextEditorHistory();

    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(false);
    expect(history.undo()).toBeNull();
    expect(history.redo()).toBeNull();
  });

  it('coalesces a typing burst but breaks it at a whitespace character', () => {
    const history = createRichTextEditorHistory();

    for (const value of ['h', 'he', 'hel', 'hell', 'hello']) history.commit({ value, selection: null });

    // crossing the space starts the next entry, which the rest of the word then joins
    history.commit({ value: 'hello w', selection: null });
    history.commit({ value: 'hello wo', selection: null });
    history.commit({ value: 'hello world', selection: null });

    expect(history.undo()?.value).toBe('hello');
    expect(history.undo()?.value).toBe('');
    expect(history.canUndo()).toBe(false);
  });

  it('gives every boundary commit its own entry', () => {
    const history = createRichTextEditorHistory();

    history.commit({ value: 'a', selection: null }, true);
    history.commit({ value: 'ab', selection: null }, true);

    expect(history.undo()?.value).toBe('a');
    expect(history.undo()?.value).toBe('');
  });

  it('treats a commit that did not change the value as a caret move', () => {
    const history = createRichTextEditorHistory();

    history.commit({ value: 'a', selection: { start: 1, end: 1 } }, true);
    history.commit({ value: 'a', selection: { start: 0, end: 0 } }, true);

    expect(history.canUndo()).toBe(true);
    expect(history.undo()?.value).toBe('');
    expect(history.redo()?.selection).toEqual({ start: 0, end: 0 });
  });

  it('replays undone states with redo', () => {
    const history = createRichTextEditorHistory();

    history.commit({ value: 'a', selection: null }, true);
    history.commit({ value: 'b', selection: null }, true);
    history.undo();
    history.undo();

    expect(history.redo()?.value).toBe('a');
    expect(history.redo()?.value).toBe('b');
    expect(history.canRedo()).toBe(false);
  });

  it('drops the redo branch once editing resumes', () => {
    const history = createRichTextEditorHistory();

    history.commit({ value: 'a', selection: null }, true);
    history.commit({ value: 'b', selection: null }, true);
    history.undo();

    expect(history.canRedo()).toBe(true);

    history.commit({ value: 'c', selection: null }, true);

    expect(history.canRedo()).toBe(false);
    expect(history.undo()?.value).toBe('a');
  });

  it('never merges the next keystroke into a state that was just restored', () => {
    const history = createRichTextEditorHistory();

    history.commit({ value: 'ab', selection: null });
    history.undo();
    history.commit({ value: 'ax', selection: null });

    expect(history.undo()?.value).toBe('');
  });

  it('caps its depth, dropping the oldest states', () => {
    const history = createRichTextEditorHistory();

    for (let i = 1; i <= 150; i++) history.commit({ value: `v${i}`, selection: null }, true);

    let oldest: string | undefined;

    while (history.canUndo()) oldest = history.undo()?.value;

    // 100 states are kept, so the baseline and everything up to v50 fell off the bottom
    expect(oldest).toBe('v51');
  });

  it('restarts from a value the editor did not produce', () => {
    const history = createRichTextEditorHistory();

    history.commit({ value: 'typed', selection: null }, true);
    history.reset('external');

    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(false);
  });
});
