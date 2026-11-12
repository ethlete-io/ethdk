import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideColorThemesWithTailwind4 } from '@ethlete/core';
import { THEMES } from '../../../themes';
import { BuildBlocker, BuildReadyFooterComponent, BuildReadyStatus } from './build-ready-footer.component';

const withTooltip = (root: Element | null | undefined, text: string) =>
  [...(root?.querySelectorAll<HTMLElement>('[aria-describedby]') ?? [])].find((element) =>
    (element.getAttribute('aria-describedby') ?? '')
      .split(' ')
      .some((id) => document.getElementById(id)?.textContent?.trim() === text),
  ) ?? null;

const render = async (status: BuildReadyStatus) => {
  TestBed.configureTestingModule({
    providers: [provideZonelessChangeDetection(), provideColorThemesWithTailwind4(THEMES)],
  });

  const fixture = TestBed.createComponent(BuildReadyFooterComponent);

  fixture.componentRef.setInput('status', status);
  await fixture.whenStable();

  const element = fixture.nativeElement as HTMLElement;
  const toggle = () => element.querySelector<HTMLButtonElement>('button[aria-expanded]');

  return { fixture, element, toggle };
};

describe('BuildReadyFooterComponent', () => {
  it('shows Baubereit without a Gründe toggle', async () => {
    const { element, toggle } = await render({ state: 'ready' });

    expect(element.textContent).toContain('Baubereit');
    expect(toggle()).toBeNull();
  });

  it('shows Wird geprüft while checking', async () => {
    const { element, toggle } = await render({ state: 'checking' });

    expect(element.textContent).toContain('Wird geprüft');
    expect(toggle()).toBeNull();
  });

  it('counts the blockers and opens them grouped by kind', async () => {
    const { fixture, element, toggle } = await render({
      state: 'blocked',
      blockers: [
        { kind: 'stale-record', text: 'kein Prüfergebnis' },
        { kind: 'embedded', text: 'components/x ist nicht baubereit', part: 'components/x' },
        { kind: 'embedded', text: 'components/y ist nicht baubereit', part: 'components/y' },
      ],
    });

    expect(element.textContent).toContain('Nicht baubereit (3)');
    expect(toggle()?.getAttribute('aria-expanded')).toBe('false');

    toggle()?.click();
    await fixture.whenStable();

    expect(toggle()?.getAttribute('aria-expanded')).toBe('true');
    expect([...element.querySelectorAll('h3')].map((heading) => heading.textContent?.trim())).toEqual([
      'Eingebettete Teile',
      'Prüfstand',
    ]);
    expect(element.textContent).not.toContain('Sketch öffnen');
  });

  it('shows the agent progress beside the status with its detail as the tooltip', async () => {
    const { fixture, element } = await render({ state: 'ready' });

    fixture.componentRef.setInput('agent', { state: 'working', doing: 'prüft', detail: 'compare für pressed' });
    await fixture.whenStable();

    const badge = withTooltip(element, 'compare für pressed');

    expect(badge?.textContent?.trim()).toBe('Agent prüft');

    fixture.componentRef.setInput('agent', { state: 'failed', detail: 'tsc bricht ab' });
    await fixture.whenStable();

    expect(withTooltip(element, 'tsc bricht ab')?.textContent?.trim()).toBe('Agent fehlgeschlagen');
  });

  it('emits the direct edit from Sketch öffnen', async () => {
    const edit: BuildBlocker = { kind: 'direct-edit', text: 'Bild ohne Sketch geändert' };
    const { fixture, element } = await render({ state: 'blocked', blockers: [edit] });
    const emitted: BuildBlocker[] = [];

    fixture.componentInstance.openEditSketch.subscribe((blocker) => emitted.push(blocker));
    fixture.componentRef.setInput('blockersOpen', true);
    await fixture.whenStable();
    [...element.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent?.trim() === 'Sketch öffnen')
      ?.click();

    expect(emitted).toEqual([edit]);
  });
});
