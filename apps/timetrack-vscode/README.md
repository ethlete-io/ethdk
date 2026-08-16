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

## Installing it from this repository

The extension is not published. Build it, then link the folder into your editor's extension
directory:

```bash
npx nx build timetrack-vscode
ln -s "$PWD/apps/timetrack-vscode" ~/.vscode/extensions/ethlete.timetrack-vscode-0.1.0
```

Then restart VS Code. Rebuilding is enough after that — the link points at the same folder.

## Turning it off

`timetrack.enabled` is a normal setting, so setting it to `false` in one workspace's
`.vscode/settings.json` leaves that project out entirely while the rest keep reporting.
