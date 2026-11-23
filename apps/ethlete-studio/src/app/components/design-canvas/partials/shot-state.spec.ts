import { Component, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SHOT_RETRY_MS, ShotStateDirective, injectFailedShots } from './shot-state';

@Component({
  template: `<img [src]="src" ethleteShot alt="" />`,
  imports: [ShotStateDirective],
})
class HostComponent {
  src = '/shot.png';
}

describe('FailedShots', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('counts a failed shot until its image is gone', async () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });

    const fixture = TestBed.createComponent(HostComponent);
    const failedShots = TestBed.runInInjectionContext(injectFailedShots);

    TestBed.tick();
    expect(failedShots?.count()).toBe(0);

    const img = fixture.nativeElement.querySelector('img');

    img.dispatchEvent(new Event('error'));
    await vi.advanceTimersByTimeAsync(SHOT_RETRY_MS);
    img.dispatchEvent(new Event('error'));
    TestBed.tick();
    expect(failedShots?.count()).toBe(1);

    fixture.destroy();
    TestBed.tick();
    expect(failedShots?.count()).toBe(0);
  });

  it('shows a shot neutral after its first error and reloads it, and fails only when the reload errors too', async () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });

    const fixture = TestBed.createComponent(HostComponent);

    TestBed.tick();

    const img: HTMLImageElement = fixture.nativeElement.querySelector('img');
    const reload = vi.spyOn(img, 'src', 'set');

    img.dispatchEvent(new Event('error'));
    TestBed.tick();
    expect(img.dataset['shotState']).toBe('loading');

    await vi.advanceTimersByTimeAsync(SHOT_RETRY_MS);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(img.dataset['shotState']).toBe('loading');

    img.dispatchEvent(new Event('load'));
    TestBed.tick();
    expect(img.dataset['shotState']).toBe('loaded');
  });
});
