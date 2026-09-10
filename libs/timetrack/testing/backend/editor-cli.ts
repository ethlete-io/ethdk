import { EDITOR_CLIS, EditorCli, ProcessSpec, TIMETRACK_EXTENSION_ID } from '@ethlete/timetrack';

/** What one editor is on the seeded machine. */
export type FakeEditorState = {
  /** `false` makes the host answer as it does for a client that is not on the `PATH`. */
  onPath: boolean;
  /** Whether `--list-extensions` names this app's reporter. */
  reporter: boolean;
  /** A client that is there and answers with a failure — the state that is neither of the other two. */
  fails?: string;
};

export type FakeEditors = Record<EditorCli, FakeEditorState>;

/** Two extensions any machine has, so a listing that holds the reporter has to be searched for it. */
const OTHER_EXTENSIONS = ['dbaeumer.vscode-eslint', 'esbenp.prettier-vscode'];

export const isEditorSpec = (spec: ProcessSpec) =>
  EDITOR_CLIS.includes(spec.command as EditorCli) && spec.args[0] === '--list-extensions';

export const runFakeEditor = (state: FakeEditorState) => {
  if (state.fails) return { code: 1, stdout: '', stderr: state.fails };

  const listed = state.reporter ? [...OTHER_EXTENSIONS, TIMETRACK_EXTENSION_ID] : OTHER_EXTENSIONS;

  return { code: 0, stdout: `${listed.join('\n')}\n`, stderr: '' };
};
