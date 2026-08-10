import { suppressTextSelection } from './text-selection';

describe('suppressTextSelection', () => {
  afterEach(() => (document.documentElement.style.userSelect = ''));

  it('suppresses selection until the release is called', () => {
    const release = suppressTextSelection(document);

    expect(document.documentElement.style.userSelect).toBe('none');

    release();

    expect(document.documentElement.style.userSelect).toBe('');
  });

  it('keeps selection suppressed until the last of several gestures releases', () => {
    const releaseFirst = suppressTextSelection(document);
    const releaseSecond = suppressTextSelection(document);

    releaseFirst();

    expect(document.documentElement.style.userSelect).toBe('none');

    releaseSecond();

    expect(document.documentElement.style.userSelect).toBe('');
  });

  it('ignores a release called twice', () => {
    const releaseFirst = suppressTextSelection(document);
    const releaseSecond = suppressTextSelection(document);

    releaseFirst();
    releaseFirst();

    expect(document.documentElement.style.userSelect).toBe('none');

    releaseSecond();

    expect(document.documentElement.style.userSelect).toBe('');
  });

  it('restores an inline value the document already had', () => {
    document.documentElement.style.userSelect = 'text';

    const release = suppressTextSelection(document);

    expect(document.documentElement.style.userSelect).toBe('none');

    release();

    expect(document.documentElement.style.userSelect).toBe('text');
  });
});
