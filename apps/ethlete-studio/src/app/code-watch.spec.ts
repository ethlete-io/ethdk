import { StudioCodeState } from '../host/studio-code';
import { codeNoticeOf, pushNoticeOf } from './code-watch';

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

  it('asks to restart Studio after a commit in the host', () => {
    expect(codeNoticeOf({ ...settled, host: { running: A, latest: B } }, A)).toEqual({
      text: 'Host geändert - Studio neu starten',
      action: 'restartStudio',
    });
  });

  it('asks to restart the server after a commit in the cli', () => {
    expect(codeNoticeOf({ ...settled, cli: { running: A, latest: B, dirty: false } }, A)).toEqual({
      text: 'CLI geändert - neu starten',
      action: 'restartServer',
    });
  });

  it('names the commit it runs on while the cli has uncommitted changes, and offers no click', () => {
    expect(codeNoticeOf({ ...settled, cli: { running: A, latest: B, dirty: true } }, A)).toEqual({
      text: 'CLI hat uncommittete Änderungen, Studio läuft auf Stand aaaaaaa',
      action: null,
    });
  });

  it('asks to restart the server after a commit to the app copy', () => {
    expect(codeNoticeOf({ ...settled, frontend: { latest: B } }, A)).toEqual({
      text: 'Oberfläche geändert - neu starten',
      action: 'restartServer',
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

describe('pushNoticeOf', () => {
  it('passes the unpushed commits, the gate and the age of the oldest in hours', () => {
    expect(pushNoticeOf({ unpushed: 158, oldestAgeHours: 31.5, gate: 'red' })).toEqual({
      unpushed: 158,
      age: '31,5 h',
      gate: 'red',
    });
    expect(pushNoticeOf({ unpushed: 2, oldestAgeHours: null, gate: 'unknown' })?.age).toBe('0 h');
  });

  it('shows nothing when everything is pushed or the host reports no push state', () => {
    expect(pushNoticeOf({ unpushed: 0, oldestAgeHours: null, gate: 'unknown' })).toBeNull();
    expect(pushNoticeOf(null)).toBeNull();
    expect(pushNoticeOf(undefined)).toBeNull();
  });
});
