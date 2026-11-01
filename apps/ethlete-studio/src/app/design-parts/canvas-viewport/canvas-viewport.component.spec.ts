import { Component, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CanvasViewportComponent } from './canvas-viewport.component';

@Component({
  imports: [CanvasViewportComponent],
  template: `<ethlete-canvas-viewport class="relative h-56 w-128"><div data-world></div></ethlete-canvas-viewport>`,
})
class HostComponent {}

describe('CanvasViewportComponent', () => {
  it('projects its content and takes keyboard focus with the SDK focus ring', async () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });

    const fixture = TestBed.createComponent(HostComponent);

    await fixture.whenStable();

    const viewport = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('ethlete-canvas-viewport');

    expect(viewport?.querySelector('[data-world]')).not.toBeNull();
    expect(viewport?.getAttribute('aria-label')).toBe('Design Canvas');
    expect(viewport?.classList).toContain('et-focus-ring');
    expect(viewport?.classList).toContain('h-56');

    viewport?.focus();

    expect(document.activeElement).toBe(viewport);
  });
});
