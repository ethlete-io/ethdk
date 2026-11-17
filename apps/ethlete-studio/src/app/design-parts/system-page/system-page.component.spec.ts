import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideColorThemesWithTailwind4 } from '@ethlete/core';
import { THEMES } from '../../../themes';
import { STUDIO_LABELS } from '../../i18n/studio-labels';
import { SystemPageComponent } from './system-page.component';

const LABELS = STUDIO_LABELS.system;

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
    expect(root.querySelector('[data-comment-list]')?.textContent).toContain(STUDIO_LABELS.commentList.open(3));
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
