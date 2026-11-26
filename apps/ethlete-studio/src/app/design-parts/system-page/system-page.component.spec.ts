import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideColorThemesWithTailwind4 } from '@ethlete/core';
import { THEMES } from '../../../themes';
import { SYSTEM_LABELS } from '../../i18n/system-labels';
import { COMMENT_THREAD_LABELS, COMMENT_LIST_LABELS } from '../../i18n/comments-labels';
import { SHELL_LABELS } from '../../i18n/shell-labels';
import { SystemPageComponent } from './system-page.component';

const LABELS = SYSTEM_LABELS;

const render = async (inputs: Record<string, unknown>) => {
  TestBed.configureTestingModule({
    providers: [provideZonelessChangeDetection(), provideColorThemesWithTailwind4(THEMES)],
  });

  const fixture = TestBed.createComponent(SystemPageComponent);

  Object.entries(inputs).forEach(([name, value]) => fixture.componentRef.setInput(name, value));
  await fixture.whenStable();

  return fixture;
};

describe('SystemPageComponent', () => {
  it('shows the Esc oder C hint in comment mode only without a draft', async () => {
    const fixture = await render({ commentMode: true });
    const actions = () =>
      (fixture.nativeElement as HTMLElement).querySelector('[data-canvas-actions]')?.textContent ?? '';

    expect(actions()).toContain(LABELS.commentModeEnds);

    fixture.componentRef.setInput('draft', 'Zu blass.');
    await fixture.whenStable();

    expect(actions()).not.toContain(LABELS.commentModeEnds);
  });

  it('opens a thread beside its pin and emits the withdrawn message index and the close', async () => {
    const fixture = await render({
      comments: [
        {
          id: 'p1',
          at: { x: 10, y: 20 },
          author: 'Ada Long',
          initials: 'AL',
          when: 'jetzt',
          part: 'card',
          state: 'rest',
          text: 'Eins',
          replies: 1,
        },
      ],
      thread: {
        id: 'p1',
        place: 'card › rest',
        messages: [
          { author: 'Ada Long', initials: 'AL', when: 'jetzt', text: 'Eins' },
          { author: 'Ada Long', initials: 'AL', own: true, when: 'jetzt', text: 'Zwei' },
        ],
      },
    });
    const root: HTMLElement = fixture.nativeElement;
    const withdrawn: number[] = [];
    const closed: unknown[] = [];

    fixture.componentInstance.withdrawComment.subscribe((index) => withdrawn.push(index));
    fixture.componentInstance.closeThread.subscribe(() => closed.push(true));
    const card = root.querySelector('ethlete-thread-card');

    expect(card?.textContent).toContain('card › rest');
    expect((card?.parentElement as HTMLElement).style.left).toBe('calc(10% + var(--space-6))');
    [...(card?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
      .find((button) => button.textContent?.trim() === COMMENT_THREAD_LABELS.withdraw)
      ?.click();
    card?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(withdrawn).toEqual([1]);
    expect(closed).toEqual([true]);
  });

  it('shows a failed listing as an error card with the reason, an empty tree and no frames', async () => {
    const fixture = await render({ listingError: 'listing timed out after 30 s for product app-b' });
    const root: HTMLElement = fixture.nativeElement;
    const card = root.querySelector('[data-listing-error]');

    expect(card?.textContent).toContain(LABELS.listingFailed);
    expect(card?.textContent).toContain('listing timed out after 30 s for product app-b');
    expect(root.querySelector('ethlete-part-tree')).toBeNull();
    expect(root.querySelector('ethlete-canvas-frames')).toBeNull();
    expect(root.querySelector('ethlete-open-points-chip')).toBeNull();
  });

  it('emits reload from Erneut laden', async () => {
    const fixture = await render({ listingError: 'missing build: pages/inbox' });
    const reloads: unknown[] = [];

    fixture.componentInstance.reload.subscribe(() => reloads.push(true));

    const button = [...fixture.nativeElement.querySelectorAll('[data-listing-error] button')].find(
      (candidate: HTMLElement) => candidate.textContent?.trim() === LABELS.reload,
    ) as HTMLButtonElement | undefined;

    button?.click();

    expect(reloads).toHaveLength(1);
  });

  it('shows the part tree and the canvas without a listing error', async () => {
    const root: HTMLElement = (await render({})).nativeElement;

    expect(root.querySelector('[data-listing-error]')).toBeNull();
    expect(root.querySelector('ethlete-part-tree')).not.toBeNull();
  });

  it('places a pin per comment and lists them under the tree, with the picked one selected', async () => {
    const comment = {
      author: 'human',
      initials: 'MK',
      when: 'gestern',
      part: 'card',
      state: 'rest',
      text: 'Zu viel Abstand',
      replies: 0,
    };
    const root: HTMLElement = (
      await render({
        comments: [
          { ...comment, id: 'a', at: { x: 10, y: 80 } },
          { ...comment, id: 'b', at: { x: 90, y: 5 } },
          { ...comment, id: 'c', at: { x: 50, y: 50 } },
        ],
        selectedComment: 'b',
      })
    ).nativeElement;
    const pins = [...root.querySelectorAll<HTMLElement>('ethlete-comment-pin')];

    expect(pins).toHaveLength(3);
    expect(pins[1]?.parentElement?.style.left).toBe('90%');
    expect(root.querySelector('[data-comment-list]')?.textContent).toContain(COMMENT_LIST_LABELS.open(3));
  });

  it('pins the draft of the writer only beside listed comments', async () => {
    const writer = { author: 'human', initials: 'LS' };
    const listed = await render({ commentMode: true, draft: 'x', writer, comments: [] });

    expect(listed.nativeElement.querySelectorAll('ethlete-comment-pin')).toHaveLength(1);

    TestBed.resetTestingModule();

    const alone = await render({ commentMode: true, draft: 'x', writer });

    expect(alone.nativeElement.querySelectorAll('ethlete-comment-pin')).toHaveLength(0);
  });
});

describe('SystemPageComponent canvas note', () => {
  it('shows the sketch bar with comment and open count once a part is loaded, and no second copy', async () => {
    const fixture = await render({ noted: false, noteTitle: '', noteHint: '', empty: false, part: '' });
    const root: HTMLElement = fixture.nativeElement;

    expect(root.querySelector('ethlete-sketch-head')).toBeNull();

    fixture.componentRef.setInput('part', 'components/button');
    fixture.componentRef.setInput('nothingOpen', true);
    await fixture.whenStable();

    const bars = root.querySelectorAll('ethlete-sketch-head');

    expect(bars).toHaveLength(1);
    expect(bars[0]?.querySelector('[data-sk-comment]')?.getAttribute('aria-label')).toBe(LABELS.comment);
    expect(bars[0]?.querySelector('[data-open-points-chip]')?.textContent).toContain(LABELS.nothingOpen);
    expect(root.querySelectorAll('[data-sk-comment]')).toHaveLength(1);
    expect(root.querySelectorAll('[data-open-points-chip]')).toHaveLength(1);
    expect(root.querySelector('[data-canvas-actions]')?.querySelector('[data-open-points-chip],button')).toBeNull();
    expect(bars[0]?.querySelector('[data-sk-discard]')).toBeNull();
    expect(bars[0]?.querySelector('ethlete-sketch-status-badge')).toBeNull();
  });

  it('draws the note title and hint as a card, and omits an empty hint', async () => {
    const fixture = await render({ noted: true, noteTitle: 'Lesefehler', noteHint: 'boom' });
    const card: HTMLElement = fixture.nativeElement.querySelector('[data-canvas-note]');

    expect(card.textContent).toContain('Lesefehler');
    expect(card.textContent).toContain('boom');
    expect(card.querySelector('svg')).not.toBeNull();

    fixture.componentRef.setInput('noteHint', '');
    await fixture.whenStable();

    expect(card.querySelectorAll('p')).toHaveLength(1);
  });
});

describe('SystemPageComponent legacy call', () => {
  it('shows a legacy call without a header bar and emits the transfer of its slug', async () => {
    const fixture = await render({
      call: {
        slug: 'shop/basket/07-long-name',
        headline: 'Ein sehr langer Titel für den Warenkorb',
        transferred: false,
      },
      themeSwitches: [{ kind: 'surface', names: ['hell', 'dunkel'], current: 'hell' }],
    });
    const root = fixture.nativeElement as HTMLElement;
    const transferred: string[] = [];

    fixture.componentInstance.markTransferred.subscribe((slug) => transferred.push(slug));

    expect(root.querySelector('h2')?.closest('header')).toBeNull();
    expect(root.querySelector('h2')?.textContent?.trim()).toBe('Ein sehr langer Titel für den Warenkorb');
    expect(root.textContent).toContain('shop/basket/07-long-name');

    const transfer = [...root.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === SHELL_LABELS.markTransferred,
    );

    transfer?.click();

    expect(transferred).toEqual(['shop/basket/07-long-name']);

    fixture.componentRef.setInput('call', {
      slug: 'shop/basket/07-long-name',
      headline: 'Ein sehr langer Titel für den Warenkorb',
      transferred: true,
    });
    await fixture.whenStable();

    expect(root.querySelector('et-badge')?.textContent?.trim()).toBe(SHELL_LABELS.transferred);
  });
});
