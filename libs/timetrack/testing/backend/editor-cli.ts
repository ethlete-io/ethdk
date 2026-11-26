import { EDITOR_CLIS, EditorCli, ProcessSpec, TIMETRACK_EXTENSION_ID } from '@ethlete/timetrack';

/** What one editor is on the seeded machine. */
export type FakeEditorState = {
  /** `false` makes the host answer as it does for a client that is not on the `PATH`. */
  onPath: boolean;
  /** Whether `--list-extensions` names this app's reporter. */
  reporter: boolean;
  /** A client that is there and answers with a failure — the state that is neither of the other two. */
  fails?: string;
  /** What `--install-extension` writes to stderr instead of installing, when the install must fail. */
  installFails?: string;
};

export type FakeEditors = Record<EditorCli, FakeEditorState>;

/** Where `seedWorld` puts the reporter `.vsix`, standing in for the one a real bundle ships. */
export const FAKE_REPORTER_VSIX = '/Applications/Timetrack.app/Contents/Resources/timetrack-vscode.vsix';

/** Two extensions any machine has, so a listing that holds the reporter has to be searched for it. */
const OTHER_EXTENSIONS = ['dbaeumer.vscode-eslint', 'esbenp.prettier-vscode'];

const isEditorCli = (spec: ProcessSpec) => EDITOR_CLIS.includes(spec.command as EditorCli);

export const isEditorSpec = (spec: ProcessSpec) => isEditorCli(spec) && spec.args[0] === '--list-extensions';

export const isEditorInstallSpec = (spec: ProcessSpec) => isEditorCli(spec) && spec.args[0] === '--install-extension';

export const runFakeEditor = (state: FakeEditorState) => {
  if (state.fails) return { code: 1, stdout: '', stderr: state.fails };

  const listed = state.reporter ? [...OTHER_EXTENSIONS, TIMETRACK_EXTENSION_ID] : OTHER_EXTENSIONS;

  return { code: 0, stdout: `${listed.join('\n')}\n`, stderr: '' };
};

/**
 * Installs the reporter into one seeded editor, which a later `--list-extensions` then names.
 *
 * A client refuses a `.vsix` it cannot find, so the fake checks the path the app passed rather than
 * accepting any: that is what proves the app read the bundled path instead of inventing one.
 */
export const runFakeEditorInstall = (options: { state: FakeEditorState; spec: ProcessSpec; vsix: string | null }) => {
  const { state, spec, vsix } = options;

  if (state.installFails) return { code: 1, stdout: '', stderr: state.installFails };

  if (spec.args[1] !== vsix) {
    return { code: 1, stdout: '', stderr: `Extension '${spec.args[1]}' not found.` };
  }

  state.reporter = true;

  return { code: 0, stdout: `Extension '${TIMETRACK_EXTENSION_ID}' was successfully installed.\n`, stderr: '' };
};
