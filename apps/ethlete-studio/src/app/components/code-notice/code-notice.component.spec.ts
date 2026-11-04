import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { StudioCodeState } from '../../../host/studio-code';
import { injectCodeWatch } from '../../code-watch';
import { CodeNoticeComponent } from './code-notice.component';

const host = vi.hoisted(() => ({ state: null as StudioCodeState | null, quit: vi.fn() }));

vi.mock('../../../host/studio-code', () => ({
  studioCodeState$: () => of(host.state),
  quitForRebuild$: () => {
    host.quit();

    return of(undefined);
  },
}));

const OLD = 'a'.repeat(40);
const NEW = 'b'.repeat(40);

const running: StudioCodeState = {
  cli: { running: OLD, latest: OLD, dirty: false },
  frontend: { latest: OLD },
  host: { running: OLD, latest: OLD },
};

const render = async (state: StudioCodeState) => {
  host.state = state;
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });

  const fixture = TestBed.createComponent(CodeNoticeComponent);
  const restarts = vi.fn();

  TestBed.runInInjectionContext(() => injectCodeWatch()).serverRestarts$.subscribe(restarts);
  await new Promise((resolve) => setTimeout(resolve));
  await fixture.whenStable();

  const element = fixture.nativeElement as HTMLElement;

  return { element, restarts, button: element.querySelector<HTMLButtonElement>('button') };
};

describe('CodeNoticeComponent', () => {
  beforeEach(() => host.quit.mockClear());

  it('draws nothing while the server runs the latest commit', async () => {
    const { element } = await render(running);

    expect(element.querySelector('[data-code-notice]')).toBeNull();
  });

  it('offers the restart while the server runs an older cli commit', async () => {
    const { element, button, restarts } = await render({ ...running, cli: { ...running.cli, latest: NEW } });

    expect(element.textContent).toContain('CLI geändert - neu starten');
    expect(button?.textContent?.trim()).toBe('Neu starten');

    button?.click();

    expect(restarts).toHaveBeenCalledTimes(1);
    expect(host.quit).not.toHaveBeenCalled();
  });

  it('offers the restart after a commit to a source of the app copy', async () => {
    const { element, button, restarts } = await render({ ...running, frontend: { latest: NEW } });

    expect(element.textContent).toContain('Oberfläche geändert - neu starten');

    button?.click();

    expect(restarts).toHaveBeenCalledTimes(1);
  });

  it('quits for a rebuild after a host commit', async () => {
    const { button, restarts } = await render({ ...running, host: { running: OLD, latest: NEW } });

    button?.click();

    expect(host.quit).toHaveBeenCalledTimes(1);
    expect(restarts).not.toHaveBeenCalled();
  });

  it('offers no click while the cli has uncommitted changes', async () => {
    const { element, button } = await render({ ...running, cli: { ...running.cli, dirty: true } });

    expect(element.textContent).toContain(`Studio läuft auf Stand ${OLD.slice(0, 7)}`);
    expect(button).toBeNull();
  });
});
