import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideColorThemesWithTailwind4 } from '@ethlete/core';
import { THEMES } from '../../../themes';
import { InboxComponent, InboxLoad } from './inbox.component';
import { InboxComment } from './inbox-sample';

const comment = (id: string, part: string, resolved = false): InboxComment => ({
  id,
  author: `Autor ${id}`,
  initials: 'AU',
  when: 'vor 1 Tag',
  part,
  state: 'default',
  text: `Text ${id}`,
  replies: 0,
  resolved,
});

const COMMENTS = [comment('x1', 'tabs'), comment('x2', 'tabs', true), comment('x3', 'chip')];

const render = async (comments: InboxComment[], load: InboxLoad = 'loaded') => {
  TestBed.configureTestingModule({
    providers: [provideZonelessChangeDetection(), provideColorThemesWithTailwind4(THEMES)],
  });

  const fixture = TestBed.createComponent(InboxComponent);

  fixture.componentRef.setInput('comments', comments);
  fixture.componentRef.setInput('activePart', 'tabs');
  fixture.componentRef.setInput('load', load);
  await fixture.whenStable();

  const element = fixture.nativeElement as HTMLElement;
  const text = () => element.textContent?.replace(/\s+/gu, ' ') ?? '';

  return { fixture, element, text };
};

describe('InboxComponent', () => {
  it('counts only open comments and lists them under their part', async () => {
    const { text } = await render(COMMENTS);

    expect(text()).toContain('2 offen');
    expect(text()).toContain('Text x1');
    expect(text()).toContain('Text x3');
    expect(text()).not.toContain('Text x2');
  });

  it('shows resolved comments when the switch is on', async () => {
    const { fixture, text } = await render(COMMENTS);

    fixture.componentInstance.showResolved.set(true);
    await fixture.whenStable();

    expect(text()).toContain('Text x2');
    expect(text()).toContain('2 offen');
  });

  it('shows the empty state without comments', async () => {
    const { text } = await render([]);

    expect(text()).toContain('0 offen');
    expect(text()).toContain('Keine offenen Kommentare');
    expect(text()).toContain('erscheinen hier');
  });

  it('says so when the active part has no open comment', async () => {
    const { text } = await render([comment('y1', 'chip')]);

    expect(text()).toContain('Keine offenen Kommentare zu tabs.');
    expect(text()).toContain('Text y1');
  });

  it('shows the error state and emits retry', async () => {
    const { fixture, element, text } = await render(COMMENTS, 'error');
    const retry = vi.fn();

    fixture.componentInstance.retry.subscribe(retry);

    expect(text()).toContain('Kommentare nicht geladen');
    expect(text()).not.toContain('Text x1');

    const button = [...element.querySelectorAll('button')].find((b) => b.textContent?.includes('Erneut laden'));

    button?.click();

    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('shows the loading state', async () => {
    const { text } = await render(COMMENTS, 'loading');

    expect(text()).toContain('Kommentare werden geladen…');
  });
});
