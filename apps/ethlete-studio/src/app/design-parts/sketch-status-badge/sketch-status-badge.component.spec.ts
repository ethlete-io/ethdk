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

    expect(host.querySelector('[data-sk-status]')?.textContent?.trim()).toBe(label);
  });

  // Decision: a pick in Studio is a merge, so there is no picked badge.
  it('has no picked status', () => {
    expect(Object.keys(SKETCHES_LABELS.status)).toEqual([
      'drawing',
      'waiting',
      'awaitingApproval',
      'awaitingSubParts',
      'approved',
      'paused',
      'failed',
      'merging',
    ]);
  });

  // Decision B726: an approval is a good state, so its dot takes the success tone, not the grey of a paused sketch.
  it('puts the dot of an approved sub-sketch in the success colour theme', async () => {
    const approved = await render('approved');
    const dot = approved.querySelector<HTMLElement>('[data-sk-status-dot]');

    TestBed.resetTestingModule();

    const paused = (await render('paused')).querySelector<HTMLElement>('[data-sk-status-dot]');

    expect(dot?.className).toContain('bg-(--et-theme-color-primary-solid)');
    expect(dot?.className).toContain('et-color--success');
    expect(paused?.className).not.toContain('et-color--success');
  });

  it('puts only the failed badge in the error colour theme', async () => {
    const failed = await render('failed');
    const failedStyle = failed.querySelector('span')?.className;

    TestBed.resetTestingModule();

    const waiting = await render('waiting');

    expect(failed.querySelector('[data-sk-status]')?.textContent?.trim()).toBe(SKETCHES_LABELS.status.failed);
    expect(failedStyle).not.toBe(waiting.querySelector('span')?.className);
  });
});
