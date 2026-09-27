import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DIVIDER_IMPORTS, DividerOrientation } from '../index';
import '../test-helpers';
import { useScenario } from './harness';

@Component({
  selector: 'et-scenario-editor-actions',
  imports: [DIVIDER_IMPORTS],
  template: `
    <section>
      <p>Details</p>
      <et-divider class="section" />
      <p>Danger zone</p>
    </section>
    <div class="actions">
      <button type="button">Save</button>
      <et-divider [orientation]="orientation()" [decorative]="decorative()" class="between" />
      <button type="button">Discard</button>
    </div>
  `,
})
class EditorActionsComponent {
  orientation = signal<DividerOrientation>('vertical');
  decorative = signal(false);
}

describe('divider scenarios', () => {
  const scenario = useScenario();

  it('announces a horizontal separator between two sections by default', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(EditorActionsComponent);
    const divider = (fixture.nativeElement as HTMLElement).querySelector('.section')!;

    s.tick();

    expect(divider.classList).toContain('et-divider');
    expect(divider.getAttribute('role')).toBe('separator');
    expect(divider.getAttribute('aria-orientation')).toBe('horizontal');
    expect(divider.getAttribute('data-orientation')).toBe('horizontal');
    expect(divider.hasAttribute('aria-hidden')).toBe(false);
    expect(divider.childNodes.length).toBe(0);
  });

  it('turns a vertical rule between buttons into pure decoration and back', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(EditorActionsComponent);
    const divider = (fixture.nativeElement as HTMLElement).querySelector('.between')!;

    s.tick();

    expect(divider.getAttribute('aria-orientation')).toBe('vertical');
    expect(divider.getAttribute('data-orientation')).toBe('vertical');

    fixture.componentInstance.decorative.set(true);
    s.tick();

    expect(divider.getAttribute('role')).toBe('presentation');
    expect(divider.getAttribute('aria-hidden')).toBe('true');
    expect(divider.hasAttribute('aria-orientation')).toBe(false);
    expect(divider.getAttribute('data-orientation')).toBe('vertical');

    fixture.componentInstance.decorative.set(false);
    s.tick();

    expect(divider.getAttribute('role')).toBe('separator');
    expect(divider.hasAttribute('aria-hidden')).toBe(false);
  });
});
