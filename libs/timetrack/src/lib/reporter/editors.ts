import { Observable, catchError, forkJoin, map, of } from 'rxjs';
import { hostFailureMessage, isMissingCliError } from '../forge/cli';
import { TimetrackProcessRunner } from '../transport/ports';

/**
 * The identifier `--list-extensions` prints for this app's own reporter, which is the publisher and
 * the name out of `apps/timetrack-vscode/package.json`. Renaming either there renames this.
 */
export const TIMETRACK_EXTENSION_ID = 'ethlete.timetrack-vscode';

/** A command-line client for VS Code or one of its forks, all of which take the same arguments. */
export type EditorCli = 'code' | 'code-insiders' | 'codium' | 'cursor' | 'windsurf';

/**
 * The editors this app looks for. It has to hold the same clients as `CLIS` in
 * `tools/scripts/install-vscode-extension.mjs`: that script is what the install command runs, so an
 * editor named here and not there is offered an install that skips it.
 */
export const EDITOR_CLIS: EditorCli[] = ['code', 'code-insiders', 'codium', 'cursor', 'windsurf'];

const EDITOR_NAMES: Record<EditorCli, string> = {
  code: 'VS Code',
  'code-insiders': 'VS Code Insiders',
  codium: 'VSCodium',
  cursor: 'Cursor',
  windsurf: 'Windsurf',
};

/**
 * What this machine can be told about one editor.
 *
 * `unreadable` is kept apart from `not-installed` on purpose: an editor whose client is there but
 * answers with a failure has told us nothing, and reporting that as a missing extension would send the
 * user to install one that may already be there.
 */
export type EditorReporterState = 'not-on-path' | 'unreadable' | 'not-installed' | 'installed';

export type EditorReporter = {
  cli: EditorCli;
  name: string;
  state: EditorReporterState;
  /** Why the editor could not be read, and `null` in every other state. */
  detail: string | null;
};

/** What the user runs to put the reporter into one editor. */
export const editorInstallCommand = (cli: EditorCli) => `TIMETRACK_VSCODE_CLI=${cli} npx nx install timetrack-vscode`;

export const editorName = (cli: EditorCli) => EDITOR_NAMES[cli];

/** Whether a listing names the reporter. The client prints one identifier per line, already lowercase. */
export const listingHoldsReporter = (listing: string) =>
  listing.split('\n').some((line) => line.trim().toLowerCase() === TIMETRACK_EXTENSION_ID);

/**
 * Asks one editor whether the reporter is installed in it.
 *
 * A client that is not on the `PATH` is not a failure — it is the answer that this editor is not on
 * this machine, and the row for it is left out rather than asked to install anything.
 */
export const probeEditorReporter$ = (options: {
  runner: TimetrackProcessRunner;
  cli: EditorCli;
}): Observable<EditorReporter> => {
  const { runner, cli } = options;
  const found = (state: EditorReporterState, detail: string | null = null): EditorReporter => ({
    cli,
    name: EDITOR_NAMES[cli],
    state,
    detail,
  });

  return runner.run$({ command: cli, args: ['--list-extensions'] }).pipe(
    map((result) => {
      if (result.code !== 0) return found('unreadable', `\`${cli} --list-extensions\` failed: ${result.stderr.trim()}`);

      return found(listingHoldsReporter(result.stdout) ? 'installed' : 'not-installed');
    }),
    catchError((error: unknown) => {
      if (isMissingCliError(error)) return of(found('not-on-path'));

      return of(found('unreadable', hostFailureMessage(error)));
    }),
  );
};

/** Every editor, in the order they are listed, so a screen reads the same on two machines. */
export const probeEditorReporters$ = (options: { runner: TimetrackProcessRunner }): Observable<EditorReporter[]> =>
  forkJoin(EDITOR_CLIS.map((cli) => probeEditorReporter$({ runner: options.runner, cli })));
