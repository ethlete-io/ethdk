import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideColorThemesWithTailwind4 } from '@ethlete/core';
import { THEMES } from '../../../themes';
import { SKETCHES_LABELS } from '../../i18n/sketches-labels';
import { SketchBadgeStatus, SketchStatusBadgeComponent } from './sketch-status-badge.component';

const render = async (status: SketchBadgeStatus) => {
  TestBed.configureTestingModule({
    providers: [provideZonelessChangeDetection(), ...provideColorThemesWithTailwind4(THEMES)],
  });

  const fixture = TestBed.createComponent(SketchStatusBadgeComponent);

  fixture.componentRef.setInput('status', status);
  await fixture.whenStable();

  return fixture.nativeElement as HTMLElement;
};

describe('SketchStatusBadgeComponent', () => {
  it.each([
    ['drawing', SKETCHES_LABELS.status.drawing],
    ['paused', SKETCHES_LABELS.status.paused],
  ] as const)('names the %s status', async (status, label) => {
    const host = await render(status);

    expect(host.querySelector('et-badge')?.textContent?.trim()).toBe(label);
  });

  it('puts only the failed badge in the error colour theme', async () => {
    const failed = await render('failed');
    const failedStyle = failed.querySelector('span')?.className;

    TestBed.resetTestingModule();

    const waiting = await render('waiting');

    expect(failed.querySelector('et-badge')?.textContent?.trim()).toBe(SKETCHES_LABELS.status.failed);
    expect(failedStyle).not.toBe(waiting.querySelector('span')?.className);
  });
});
