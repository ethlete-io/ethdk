import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FocusRingDirective } from '../index';
import '../test-helpers';
import { useScenario } from './harness';

@Component({
  selector: 'et-scenario-custom-tiles',
  imports: [FocusRingDirective],
  template: `
    <div class="tile" etFocusRing role="button" tabindex="0">Team A</div>
    <button [disabled]="disabled()" [focusRingDisabled]="plain()" class="plain" etFocusRing type="button">Plain</button>
  `,
})
class CustomTilesComponent {
  plain = signal(true);
  disabled = signal(false);
}

const keyboard = (type: 'keydown' | 'keyup', key: string, target: Element) =>
  target.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true }));

describe('focus ring scenarios', () => {
  const scenario = useScenario();

  it('presses the ring in while Enter or Space is held and releases it on keyup or blur', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(CustomTilesComponent);
    const tile = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.tile')!;

    s.tick();

    expect(tile.classList).toContain('et-focus-ring');
    expect(tile.classList).not.toContain('et-focus-ring--active');

    keyboard('keydown', 'Enter', tile);
    s.tick();

    expect(tile.classList).toContain('et-focus-ring--active');

    keyboard('keyup', 'Enter', tile);
    s.tick();

    expect(tile.classList).not.toContain('et-focus-ring--active');

    keyboard('keydown', ' ', tile);
    s.tick();

    expect(tile.classList).toContain('et-focus-ring--active');

    tile.dispatchEvent(new FocusEvent('blur'));
    s.tick();

    expect(tile.classList).not.toContain('et-focus-ring--active');
  });

  it('switches the ring off per element without swallowing the native disabled binding', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(CustomTilesComponent);
    const app = fixture.componentInstance;
    const button = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.plain')!;

    s.tick();

    expect(button.classList).not.toContain('et-focus-ring');

    app.disabled.set(true);
    s.tick();

    expect(button.disabled).toBe(true);

    app.plain.set(false);
    s.tick();

    expect(button.classList).toContain('et-focus-ring');
  });
});
