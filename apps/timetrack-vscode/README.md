# Timetrack for VS Code

Reports what this editor window is editing to the Timetrack app on the same machine. A window
title says `Visual Studio Code`; this says which checkout, which branch and which directory — which
is what lets a day name the issue the work belongs to.

## What it sends

Every 30 seconds, and only while the window has focus:

| Field       | What it is                                               |
| ----------- | -------------------------------------------------------- |
| `repoPath`  | The checkout the open file is in                         |
| `branch`    | What `.git/HEAD` names, or nothing for a detached head   |
| `directory` | The directory of the open file, relative to the checkout |
| `language`  | The editor's language id, such as `typescript`           |
| `editing`   | Whether the file changed since the last heartbeat        |

It never sends a file name and never sends file contents. It sends nothing at all while the window
is in the background, and nothing while the app's collection is paused.

## How it finds the app

The app writes `ingest.json` into its own data directory at every start, readable only by its
owner. It holds the port the app is listening on and a token that lives no longer than that run.
The extension reads the file, posts to `http://127.0.0.1:<port>/ingest`, and reads it again whenever
a post is refused — which is what makes the extension survive the app restarting under it.

The Sources view in the app names the exact path of the file, and says which reporters have posted.

## Installing it

The extension is not on the Marketplace. Build a `.vsix` from this repository and install that:

```bash
npx nx install timetrack-vscode
```

The target builds the bundle, packs it into `dist/apps/timetrack-vscode/timetrack-vscode-<version>.vsix`
and installs it into every editor CLI it finds on the PATH (`code`, `code-insiders`, `codium`, `cursor`,
`windsurf`). To install into one editor only, name its CLI:

```bash
TIMETRACK_VSCODE_CLI=cursor npx nx install timetrack-vscode
```

Restart the editor after that.

To get the `.vsix` without installing it — to hand it to somebody else, for example — run
`npx nx package timetrack-vscode`. The receiver installs it from the Extensions view, through the `...`
menu and **Install from VSIX...**, or on the command line:

```bash
code --install-extension timetrack-vscode-0.1.0.vsix --force
```

`--force` is what lets a new build replace an installed one that carries the same version number.

### While working on the extension itself

An installed `.vsix` is a copy, so every change needs `npx nx install timetrack-vscode` again. Link the
folder instead and a rebuild is enough:

```bash
code --uninstall-extension ethlete.timetrack-vscode
npx nx build timetrack-vscode
ln -s "$PWD/apps/timetrack-vscode" ~/.vscode/extensions/ethlete.timetrack-vscode-0.1.0
```

Reload the window after each rebuild. Remove the link before you install a `.vsix` again.

## Turning it off

`timetrack.enabled` is a normal setting, so setting it to `false` in one workspace's
`.vscode/settings.json` leaves that project out entirely while the rest keep reporting.
