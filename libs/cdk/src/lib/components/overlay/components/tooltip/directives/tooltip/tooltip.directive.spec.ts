import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { AnimatedOverlayDirective } from '../../../../directives/animated-overlay';
import { TooltipDirective } from './tooltip.directive';

@Component({
  template: `<button [etTooltip]="text()">Trigger</button>`,
  imports: [TooltipDirective],
})
class HostComponent {
  text = signal<string | null>('First');
}

const setup = () => {
  const fixture = TestBed.createComponent(HostComponent);

  fixture.detectChanges();

  const trigger = fixture.debugElement.query(By.directive(TooltipDirective));
  const overlay = trigger.injector.get(AnimatedOverlayDirective);

  return { fixture, trigger: trigger.nativeElement as HTMLElement, overlay };
};

describe('TooltipDirective', () => {
  afterEach(() => vi.useRealTimers());

  it('closes an open tooltip when the text becomes null', () => {
    const { fixture, overlay } = setup();
    const canUnmount = vi.spyOn(overlay, 'canUnmount');
    const unmount = vi.spyOn(overlay, 'unmount').mockImplementation(() => undefined);

    canUnmount.mockReturnValue(true);
    fixture.componentInstance.text.set(null);
    fixture.detectChanges();

    expect(unmount).toHaveBeenCalledTimes(1);
  });

  it('mounts once on hover after the text changed', () => {
    vi.useFakeTimers();

    const { fixture, trigger, overlay } = setup();
    const mount = vi.spyOn(overlay, 'mount').mockImplementation(() => undefined);

    fixture.componentInstance.text.set('Second');
    fixture.detectChanges();

    trigger.dispatchEvent(new MouseEvent('mouseenter'));
    vi.advanceTimersByTime(300);

    expect(mount).toHaveBeenCalledTimes(1);
  });
});
