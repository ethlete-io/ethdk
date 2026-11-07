import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideColorThemesWithTailwind4 } from '@ethlete/core';
import { THEMES } from '../../../themes';
import { OpenPointsPopoverComponent } from './open-points-popover.component';
import { PartException } from './system-page-sample';

const render = async (exceptions: PartException[]) => {
  TestBed.configureTestingModule({
    providers: [provideZonelessChangeDetection(), provideColorThemesWithTailwind4(THEMES)],
  });

  const fixture = TestBed.createComponent(OpenPointsPopoverComponent);

  fixture.componentRef.setInput('part', 'components/chip');
  fixture.componentRef.setInput('groups', []);
  fixture.componentRef.setInput('exceptions', exceptions);
  await fixture.whenStable();

  return { fixture, element: fixture.nativeElement as HTMLElement };
};

describe('OpenPointsPopoverComponent', () => {
  it('lists no Ausnahmen group without exceptions', async () => {
    const { element } = await render([]);

    expect(element.querySelector('h3')).toBeNull();
    expect(element.textContent).toContain('Nichts offen');
  });

  it('lists the exceptions with their state and emits the approved rule', async () => {
    const { fixture, element } = await render([
      { rule: 'dense/TOUCH-TARGET', reason: 'Die Liste ist nur für die Maus.', reopened: false },
      { rule: 'ghost/CONTRAST', reason: 'Nur im Hover sichtbar.', reopened: true },
      { rule: 'long/OVERFLOW', reason: 'Lange Namen werden abgeschnitten.', reopened: false },
    ]);
    const approved: string[] = [];

    fixture.componentInstance.approveException.subscribe((rule) => approved.push(rule));

    expect(element.querySelector('h3')?.textContent?.replace(/\s+/g, '')).toBe('Ausnahmen3');
    expect(element.textContent).toContain('wieder offen - der Teil hat sich geändert');

    const buttons = [...element.querySelectorAll<HTMLButtonElement>('button')].filter(
      (button) => button.textContent?.trim() === 'Freigeben',
    );

    expect(buttons.length).toBe(3);
    buttons[1]?.click();

    expect(approved).toEqual(['ghost/CONTRAST']);
  });
});
