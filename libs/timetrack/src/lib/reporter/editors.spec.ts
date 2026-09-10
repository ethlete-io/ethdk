import { Observable, of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { ProcessResult, ProcessSpec, TimetrackProcessRunner } from '../transport/ports';
import {
  EDITOR_CLIS,
  EditorReporter,
  EditorInstall,
  editorInstallCommand,
  installEditorReporter$,
  listingHoldsReporter,
  probeEditorReporter$,
  probeEditorReporters$,
} from './editors';

/** `code --list-extensions` on this machine on 2026-09-10, shortened to four of its lines. */
const LISTING = `dbaeumer.vscode-eslint
esbenp.prettier-vscode
ethlete.timetrack-vscode
eamodio.gitlens
`;

const ran = (result: ProcessResult) => ({ code: 0, stdout: '', stderr: '', ...result });

const probe = (answer: Observable<ProcessResult>) => {
  const runner: TimetrackProcessRunner = { run$: vi.fn(() => answer) };
  const seen = vi.fn();

  probeEditorReporter$({ runner, cli: 'code' }).subscribe(seen);

  return seen.mock.calls[0]?.[0] as EditorReporter;
};

describe('listingHoldsReporter', () => {
  it('finds the reporter among the other extensions', () => {
    expect(listingHoldsReporter(LISTING)).toBe(true);
  });

  it('does not mistake an extension whose name only starts the same', () => {
    expect(listingHoldsReporter('ethlete.timetrack-vscode-old\n')).toBe(false);
  });
});

describe('probeEditorReporter$', () => {
  it('reads the reporter as installed', () => {
    expect(probe(of(ran({ stdout: LISTING })))).toEqual({
      cli: 'code',
      name: 'VS Code',
      state: 'installed',
      detail: null,
    });
  });

  it('reads an editor without it as not installed', () => {
    expect(probe(of(ran({ stdout: 'eamodio.gitlens\n' }))).state).toBe('not-installed');
  });

  it('reads a client that is not on the `PATH` as absent rather than as a failure', () => {
    expect(probe(throwError(() => 'not installed: code')).state).toBe('not-on-path');
  });

  it('keeps a client that answered with a failure apart from one missing the reporter', () => {
    const found = probe(of(ran({ code: 1, stderr: 'Unable to connect to the extension host.' })));

    expect(found.state).toBe('unreadable');
    expect(found.detail).toContain('Unable to connect');
  });

  it('reads any other failure as unreadable rather than losing the row', () => {
    expect(probe(throwError(() => new Error('the host is busy'))).state).toBe('unreadable');
  });
});

describe('probeEditorReporters$', () => {
  it('asks every editor once, and answers in the order they are listed', () => {
    const asked: ProcessSpec[] = [];
    const runner: TimetrackProcessRunner = {
      run$: (spec) => {
        asked.push(spec);

        return of(ran({ stdout: spec.command === 'cursor' ? LISTING : '' }));
      },
    };
    const seen = vi.fn();

    probeEditorReporters$({ runner }).subscribe(seen);

    const found = seen.mock.calls[0]?.[0] as EditorReporter[];

    expect(asked.map((spec) => spec.command)).toEqual(EDITOR_CLIS);
    expect(found.map((editor) => editor.cli)).toEqual(EDITOR_CLIS);
    expect(found.filter((editor) => editor.state === 'installed').map((editor) => editor.cli)).toEqual(['cursor']);
  });
});

describe('editorInstallCommand', () => {
  it('names the one editor it installs into, so a second one is not touched by accident', () => {
    expect(editorInstallCommand('cursor')).toBe('TIMETRACK_VSCODE_CLI=cursor npx nx install timetrack-vscode');
  });
});

describe('installEditorReporter$', () => {
  const install = (answer: Observable<ProcessResult>) => {
    const run$ = vi.fn(() => answer);
    const seen = vi.fn();

    installEditorReporter$({ runner: { run$ }, cli: 'cursor', vsix: '/bundle/timetrack-vscode.vsix' }).subscribe(seen);

    return {
      spec: run$.mock.calls[0]?.[0] as ProcessSpec | undefined,
      result: seen.mock.calls[0]?.[0] as EditorInstall,
    };
  };

  it('hands the editor the bundled file, and forces it over whatever is already there', () => {
    const { spec } = install(of(ran({})));

    expect(spec?.command).toBe('cursor');
    expect(spec?.args).toEqual(['--install-extension', '/bundle/timetrack-vscode.vsix', '--force']);
  });

  it('waits longer than a listing, because unpacking an extension is slower than printing a list', () => {
    const { spec } = install(of(ran({})));

    expect(spec?.timeoutMs).toBeGreaterThan(30_000);
  });

  it('reads an exit code of zero as installed', () => {
    expect(install(of(ran({}))).result).toEqual({ ok: true });
  });

  it("carries the editor's own wording out of a failing exit code", () => {
    const { result } = install(of(ran({ code: 1, stderr: 'Extension is not compatible.' })));

    expect(result).toEqual({ ok: false, detail: '`cursor --install-extension` failed: Extension is not compatible.' });
  });

  it('reports a rejected host call rather than failing the screen', () => {
    const { result } = install(throwError(() => 'not installed: cursor'));

    expect(result).toEqual({ ok: false, detail: 'not installed: cursor' });
  });
});
