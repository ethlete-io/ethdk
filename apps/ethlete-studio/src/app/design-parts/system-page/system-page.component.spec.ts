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
});
