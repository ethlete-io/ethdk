import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideColorThemesWithTailwind4 } from '@ethlete/core';
import { THEMES } from '../../../themes';
import { SYSTEM_LABELS } from '../../i18n/system-labels';
import { OpenPointsChipComponent } from './open-points-chip.component';
import { OpenPointGroup } from './system-page-sample';

const describedBy = (element: Element | null) =>
  (element?.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .map((id) => document.getElementById(id)?.textContent?.trim())
    .filter(Boolean);

const render = async (open: number) => {
  TestBed.configureTestingModule({
    providers: [provideZonelessChangeDetection(), provideColorThemesWithTailwind4(THEMES)],
  });

  const fixture = TestBed.createComponent(OpenPointsChipComponent);
  const groups: OpenPointGroup[] = open
    ? [{ icon: 'error', lines: Array.from({ length: open }, (_, index) => ({ text: `a${index}`, detail: 'b' })) }]
    : [];

  fixture.componentRef.setInput('part', 'components/chip');
  fixture.componentRef.setInput('groups', groups);
  await fixture.whenStable();

  const root = fixture.nativeElement as HTMLElement;
  const button = root.querySelector<HTMLButtonElement>('[data-open-points-chip]');

  return { root, button };
};

describe('OpenPointsChipComponent', () => {
  it('is an icon button with a speech bubble and a count badge at 3 open', async () => {
    const { root, button } = await render(3);

    expect(button?.hasAttribute('et-icon-button')).toBe(true);
    expect(button?.querySelector('svg[data-open-points-icon]')).not.toBeNull();
    expect(root.querySelector('et-badge')?.textContent?.trim()).toBe('3');
    expect(button?.getAttribute('aria-label')).toBe(SYSTEM_LABELS.openCount(3));
    expect(describedBy(button)).toContain(SYSTEM_LABELS.openCount(3));
  });

  it('shows no badge and the nothing-open tooltip at 0 open', async () => {
    const { root, button } = await render(0);

    expect(button?.hasAttribute('et-icon-button')).toBe(true);
    expect(root.querySelector('et-badge')).toBeNull();
    expect(button?.getAttribute('aria-label')).toBe(SYSTEM_LABELS.nothingOpen);
    expect(describedBy(button)).toContain(SYSTEM_LABELS.nothingOpen);
  });
});
