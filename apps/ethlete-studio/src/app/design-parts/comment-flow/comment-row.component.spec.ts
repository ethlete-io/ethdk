import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideColorThemesWithTailwind4 } from '@ethlete/core';
import { THEMES } from '../../../themes';
import type { InboxComment } from '../inbox/inbox-sample';
import { CommentRowComponent } from './comment-row.component';

const THREAD: InboxComment = {
  id: 'spec-1',
  author: 'Review-Runde mit einem sehr langen Namen',
  initials: 'RR',
  when: 'vor 3 Tagen',
  part: 'components/tree-row',
  state: 'selected · focus-visible',
  text: 'Der Pfeil sitzt zwei Pixel zu tief.',
  replies: 7,
};

const render = async (thread: InboxComment, selected = false) => {
  TestBed.configureTestingModule({
    providers: [provideZonelessChangeDetection(), provideColorThemesWithTailwind4(THEMES)],
  });

  const fixture = TestBed.createComponent(CommentRowComponent);

  fixture.componentRef.setInput('thread', thread);
  fixture.componentRef.setInput('selected', selected);
  await fixture.whenStable();

  const element = fixture.nativeElement as HTMLElement;
  const row = element.querySelector<HTMLElement>('[role="button"]');

  return { fixture, element, row };
};

describe('CommentRowComponent', () => {
  it('shows the author, initials, text, place and reply count', async () => {
    const { element } = await render(THREAD);
    const text = element.textContent?.replace(/\s+/gu, ' ') ?? '';

    expect(text).toContain('Review-Runde mit einem sehr langen Namen');
    expect(text).toContain('RR');
    expect(text).toContain('Der Pfeil sitzt zwei Pixel zu tief.');
    expect(text).toContain('components/tree-row › selected · focus-visible');
    expect(text).toContain(' 7 ');
  });

  it('drops the reply count on a resolved thread', async () => {
    const { element } = await render({ ...THREAD, resolved: true });

    expect(element.textContent).not.toContain('7');
  });

  it('reflects the selection in aria-pressed', async () => {
    const { row } = await render(THREAD, true);

    expect(row?.getAttribute('aria-pressed')).toBe('true');
  });

  it('emits pick on click, Enter and Space', async () => {
    const { fixture, row } = await render(THREAD);
    let picks = 0;

    fixture.componentInstance.pick.subscribe(() => picks++);
    row?.click();
    row?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    row?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));

    expect(picks).toBe(3);
  });
});
