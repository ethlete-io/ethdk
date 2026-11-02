import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { OVERLAY_REF } from '@ethlete/components';
import { Observable, of } from 'rxjs';
import { displayVersion, UpdateDialogComponent } from './update-dialog.component';

const host = vi.hoisted(() => ({ restart: vi.fn<() => Observable<void>>() }));

vi.mock('../../../host/update', () => ({ restartForUpdate$: host.restart }));

const render = (version: string) => {
  const overlayRef = { busy: signal(false), close: vi.fn() };

  TestBed.configureTestingModule({
    providers: [provideZonelessChangeDetection(), { provide: OVERLAY_REF, useValue: overlayRef }],
  });

  const fixture = TestBed.createComponent(UpdateDialogComponent);

  fixture.componentRef.setInput('version', version);
  fixture.detectChanges();

  const element = fixture.nativeElement as HTMLElement;
  const [later, restart] = [...element.querySelectorAll<HTMLButtonElement>('button')];

  return { element, later, restart, overlayRef };
};

describe('UpdateDialogComponent', () => {
  beforeEach(() => host.restart.mockReset().mockReturnValue(of(undefined)));

  it('drops the build metadata from the version', () => {
    expect(displayVersion('0.42.0-next.137+build.20261102.4f1c9ad7e2b3')).toBe('0.42.0-next.137');
    expect(displayVersion('1.0.0')).toBe('1.0.0');
  });

  it('asks about the version without build metadata', () => {
    const { element } = render('2.3.4-beta.1+sha.abc');

    expect(element.textContent).toContain('Update auf v2.3.4-beta.1 installieren?');
    expect(element.textContent).not.toContain('sha.abc');
    expect(element.textContent).toContain('Studio startet dafür neu.');
  });

  it('only closes the dialog on Später', () => {
    const { later, overlayRef } = render('1.0.0');

    expect(later?.textContent?.trim()).toBe('Später');
    later?.click();

    expect(overlayRef.close).toHaveBeenCalledOnce();
    expect(host.restart).not.toHaveBeenCalled();
  });

  it('asks the host to install and restart on Neu starten', () => {
    const { restart, overlayRef } = render('1.0.0');

    expect(restart?.textContent?.trim()).toBe('Neu starten');
    restart?.click();

    expect(host.restart).toHaveBeenCalledOnce();
    expect(overlayRef.close).not.toHaveBeenCalled();
  });
});
