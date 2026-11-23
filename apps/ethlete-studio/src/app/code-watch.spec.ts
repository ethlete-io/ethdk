import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { NEVER } from 'rxjs';
import { StudioCodeState } from '../host/studio-code';
import { codeNoticeOf, injectCodeWatch, pushNoticeOf } from './code-watch';

vi.mock('../host/studio-code', () => ({ studioCodeState$: () => NEVER, quitForRebuild$: () => NEVER }));

const A = 'a'.repeat(40);
const B = 'b'.repeat(40);

const settled: StudioCodeState = {
  cli: { running: A, latest: A, dirty: false },
  frontend: { latest: A },
  host: { running: A, latest: A },
};

describe('codeNoticeOf', () => {
  it('asks for nothing while Studio runs the latest commit of every part', () => {
    expect(codeNoticeOf(settled, A)).toBeNull();
    expect(codeNoticeOf(null, A)).toBeNull();
  });

  // A commit in the host shows a notice to restart Studio.
  it('asks to restart Studio after a commit in the host', () => {
    expect(codeNoticeOf({ ...settled, host: { running: A, latest: B } }, A)).toEqual({
      text: 'Host geändert - Studio neu starten',
      action: 'restartStudio',
    });
  });

  // A commit in the cli shows a restart notice, and only the click restarts the server.
  it('asks to restart the server after a commit in the cli', () => {
    expect(codeNoticeOf({ ...settled, cli: { running: A, latest: B, dirty: false } }, A)).toEqual({
      text: 'CLI geändert - neu starten',
      action: 'restartServer',
    });
  });

  // A dirty libs/cli keeps the last copy running and the notice names its commit, with no click.
  it('names the commit it runs on while the cli has uncommitted changes, and offers no click', () => {
    expect(codeNoticeOf({ ...settled, cli: { running: A, latest: B, dirty: true } }, A)).toEqual({
      text: 'CLI hat uncommittete Änderungen, Studio läuft auf Stand aaaaaaa',
      action: null,
    });
  });

  it('asks to restart the server after a commit to the app copy', () => {
    expect(codeNoticeOf({ ...settled, frontend: { latest: B } }, A)).toEqual({
      text: 'Oberfläche geändert - neu starten',
      action: 'restartServerAndReload',
    });
  });

  it('puts the host before the cli and the cli before the page', () => {
    const everything: StudioCodeState = {
      cli: { running: A, latest: B, dirty: false },
      frontend: { latest: B },
      host: { running: A, latest: B },
    };

    expect(codeNoticeOf(everything, A)?.action).toBe('restartStudio');
    expect(codeNoticeOf({ ...everything, host: settled.host }, A)?.action).toBe('restartServer');
  });

  it('asks nothing about the cli when Studio started no server from a copy', () => {
    expect(codeNoticeOf({ ...settled, cli: { running: null, latest: B, dirty: true } }, A)).toBeNull();
  });
});

describe('the restart of a changed page', () => {
  const setup = () => {
    const reload = vi.fn();
    const document = { defaultView: { location: { reload } } };

    TestBed.configureTestingModule({ providers: [{ provide: DOCUMENT, useValue: document }] });

    const watch = TestBed.runInInjectionContext(() => injectCodeWatch());
    const restarts: void[] = [];

    watch.serverRestarts$.subscribe(() => restarts.push(undefined));

    return { watch, reload, restarts };
  };

  it('restarts the server, then reloads the page and stays pending until the new page is up', () => {
    const { watch, reload, restarts } = setup();
    const action = codeNoticeOf({ ...settled, frontend: { latest: B } }, A)?.action;

    watch.act(action!);
    watch.settleRestart();

    expect(restarts).toHaveLength(1);
    expect(reload).toHaveBeenCalledOnce();
    expect(watch.restart()).toBe('pending');
  });

  it('only settles after a cli restart, with no page reload', () => {
    const { watch, reload } = setup();

    watch.act('restartServer');
    watch.settleRestart();

    expect(reload).not.toHaveBeenCalled();
    expect(watch.restart()).toBeNull();
  });
});

describe('pushNoticeOf', () => {
  it('passes the unpushed commits and the age of the oldest in hours', () => {
    expect(pushNoticeOf({ unpushed: 158, oldestAgeHours: 31.5 })).toEqual({
      unpushed: 158,
      age: '31,5 h',
    });
    expect(pushNoticeOf({ unpushed: 2, oldestAgeHours: null })?.age).toBe('0 h');
  });

  it('shows nothing when everything is pushed or the host reports no push state', () => {
    expect(pushNoticeOf({ unpushed: 0, oldestAgeHours: null })).toBeNull();
    expect(pushNoticeOf(null)).toBeNull();
    expect(pushNoticeOf(undefined)).toBeNull();
  });
});
