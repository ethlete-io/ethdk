import { Component, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ShotStateDirective, injectFailedShots } from './shot-state';

@Component({
  template: `<img [src]="src" ethleteShot alt="" />`,
  imports: [ShotStateDirective],
})
class HostComponent {
  src = '/shot.png';
}

describe('FailedShots', () => {
  it('counts a failed shot until its image is gone', async () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });

    const fixture = TestBed.createComponent(HostComponent);
    const failedShots = TestBed.runInInjectionContext(injectFailedShots);

    await fixture.whenStable();
    expect(failedShots.count()).toBe(0);

    fixture.nativeElement.querySelector('img').dispatchEvent(new Event('error'));
    await fixture.whenStable();
    expect(failedShots.count()).toBe(1);

    fixture.destroy();
    TestBed.tick();
    expect(failedShots.count()).toBe(0);
  });
});
