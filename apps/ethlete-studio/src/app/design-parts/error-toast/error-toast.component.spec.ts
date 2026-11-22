import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideColorThemesWithTailwind4 } from '@ethlete/core';
import { THEMES } from '../../../themes';
import { ErrorToastComponent } from './error-toast.component';

const render = async (heading: string, message: string) => {
  TestBed.configureTestingModule({
    providers: [provideZonelessChangeDetection(), ...provideColorThemesWithTailwind4(THEMES)],
  });

  const fixture = TestBed.createComponent(ErrorToastComponent);

  fixture.componentRef.setInput('heading', heading);
  fixture.componentRef.setInput('message', message);
  await fixture.whenStable();

  return { fixture, host: fixture.nativeElement as HTMLElement };
};

describe('ErrorToastComponent', () => {
  it('shows the heading and a long message in the error notification', async () => {
    const message = 'Der Export ist fehlgeschlagen, weil die Datei gesperrt ist. '.repeat(4).trim();
    const { host } = await render('Export fehlgeschlagen', message);

    expect(host.querySelector('et-notification')?.textContent).toContain('Export fehlgeschlagen');
    expect(host.querySelector('et-notification')?.textContent).toContain(message);
  });

  it('emits dismiss once when the dismiss button is clicked', async () => {
    const { fixture, host } = await render('Speichern fehlgeschlagen', 'Kein Schreibzugriff.');
    const dismissed = vi.fn();

    fixture.componentInstance.dismiss.subscribe(dismissed);
    host.querySelector<HTMLButtonElement>('[etnotificationdismiss]')?.click();
    await vi.waitFor(() => expect(dismissed).toHaveBeenCalledTimes(1));

    expect(dismissed).toHaveBeenCalledTimes(1);
  });
});
