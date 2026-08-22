import { RichTextEditorTrigger } from '../../rich-text-editor-trigger';
import { resolveTriggerMatch } from './rich-text-editor-trigger-detection';

describe('resolveTriggerMatch', () => {
  const triggers: RichTextEditorTrigger[] = [
    { char: '#', type: 'block', items: [] },
    { char: '@', type: 'mention', items: [] },
  ];

  let root: HTMLElement;

  beforeEach(() => {
    root = document.createElement('div');
    document.body.appendChild(root);
  });

  afterEach(() => root.remove());

  const resolve = (text: string, caretOffset: number) => {
    root.textContent = text;

    const range = document.createRange();
    range.setStart(root.firstChild as Text, caretOffset);
    range.collapse(true);

    return resolveTriggerMatch({ triggers, root, range });
  };

  it('matches the query typed between the trigger char and the caret', () => {
    expect(resolve('#alpha', 6)).toMatchObject({ charOffset: 0, caretOffset: 6, query: 'alpha' });
  });

  it('matches a freshly typed trigger char with an empty query', () => {
    expect(resolve('#', 1)).toMatchObject({ charOffset: 0, query: '' });
  });

  it('does not match a trigger char the caret sits in front of', () => {
    expect(resolve('#alpha', 0)).toBeNull();
  });

  it('does not match when the caret is at the start of a node holding no trigger char', () => {
    expect(resolve('alpha', 0)).toBeNull();
  });

  it('does not match a trigger char mid-word', () => {
    expect(resolve('user@domain', 11)).toBeNull();
  });

  it('picks the trigger char nearest the caret', () => {
    expect(resolve('#one @tw', 8)).toMatchObject({ charOffset: 5, query: 'tw' });
  });
});
