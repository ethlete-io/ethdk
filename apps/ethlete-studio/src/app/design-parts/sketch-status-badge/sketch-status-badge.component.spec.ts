import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideColorThemesWithTailwind4 } from '@ethlete/core';
import { THEMES } from '../../../themes';
import { SKETCHES_LABELS } from '../../i18n/sketches-labels';
import { SketchBadgeStatus, SketchStatusBadgeComponent } from './sketch-status-badge.component';

const render = async (status: SketchBadgeStatus, note: string | null = null) => {
  TestBed.configureTestingModule({
    providers: [provideZonelessChangeDetection(), ...provideColorThemesWithTailwind4(THEMES)],
  });

  const fixture = TestBed.createComponent(SketchStatusBadgeComponent);

  fixture.componentRef.setInput('status', status);
  fixture.componentRef.setInput('note', note);
  await fixture.whenStable();

  return { fixture, host: fixture.nativeElement as HTMLElement };
};

describe('SketchStatusBadgeComponent', () => {
  it.each(Object.keys(SKETCHES_LABELS.statusTip) as SketchBadgeStatus[])(
    'shows %s as an icon button with no text',
    async (status) => {
      const { host } = await render(status);
      const button = host.querySelector<HTMLElement>('[data-sk-status-button]');

      expect(button?.classList).toContain('et-icon-button');
      expect(button?.getAttribute('aria-label')).toBe(SKETCHES_LABELS.statusTip[status].label);
      expect(host.textContent?.trim()).toBe('');
      expect(host.querySelector('.rounded-full')).toBeNull();
    },
  );

  it('keeps the same button classes in every status, so the bar never changes width', async () => {
    const classes = new Set<string>();

    for (const status of Object.keys(SKETCHES_LABELS.statusTip) as SketchBadgeStatus[]) {
      TestBed.resetTestingModule();
      classes.add((await render(status)).host.querySelector('[data-sk-status-button]')?.className ?? '');
    }

    expect(classes.size).toBe(1);
  });

  it('opens a toggletip with the word, the detail and the note', async () => {
    const { fixture, host } = await render('paused', 'Wartet auf B1');

    host.querySelector<HTMLElement>('[data-sk-status-button]')?.click();
    await fixture.whenStable();

    const tip = document.querySelector('[data-sk-status-tip]')?.textContent ?? '';

    expect(tip).toContain(SKETCHES_LABELS.statusTip.paused.label);
    expect(tip).toContain(SKETCHES_LABELS.statusTip.paused.detail);
    expect(tip).toContain('Wartet auf B1');

    host.querySelector<HTMLElement>('[data-sk-status-button]')?.click();
    await fixture.whenStable();
  });

  it('puts only the failed badge in the error colour theme and approved in success', async () => {
    const failed = (await render('failed')).host.querySelector('[data-sk-status]')?.className;

    TestBed.resetTestingModule();

    const approved = (await render('approved')).host.querySelector('[data-sk-status]')?.className;

    TestBed.resetTestingModule();

    const waiting = (await render('waiting')).host.querySelector('[data-sk-status]')?.className;

    expect(failed).toContain('et-color--');
    expect(approved).toContain('et-color--success');
    expect(failed).not.toBe(approved);
    expect(waiting).toContain('et-color--inherited');
  });
});
