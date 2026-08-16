import { DEFAULT_HEARTBEAT_INTERVAL_MS, heartbeatRecordOf } from '@ethlete/timetrack';
import { promises as fs } from 'node:fs';
import { homedir } from 'node:os';
import * as vscode from 'vscode';
import { checkoutOf } from './checkout';
import { discoveryPathOf } from './discovery-path';
import { createReporter } from './reporter';
import { postEnvelope } from './transport';

const CONFIGURATION = 'timetrack';

const isEnabled = () => vscode.workspace.getConfiguration(CONFIGURATION).get<boolean>('enabled', true);

const activeFilePath = () => {
  const document = vscode.window.activeTextEditor?.document;

  return document?.uri.scheme === 'file' ? document.uri.fsPath : undefined;
};

/**
 * Starts reporting what this window is editing to the local timetrack app.
 *
 * Nothing is reported while the window does not have focus. That is what keeps an editor left open on
 * a second monitor from claiming the hours somebody spent in a meeting, and it is why the app can
 * treat the stretch between two heartbeats as observed time at all.
 */
export const activate = (context: vscode.ExtensionContext) => {
  const discoveryPath = discoveryPathOf({ platform: process.platform, home: homedir(), env: process.env });
  const reporter = createReporter({
    readDiscovery: async () => {
      try {
        return JSON.parse(await fs.readFile(discoveryPath, 'utf8')) as unknown;
      } catch {
        return null;
      }
    },
    post: postEnvelope,
  });

  let edited = false;

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.contentChanges.length) edited = true;
    }),
  );

  const beat = async () => {
    if (!isEnabled() || !vscode.window.state.focused) return;

    const filePath = activeFilePath();
    const checkout = filePath
      ? await checkoutOf({
          fs: {
            isDirectory: async (path) => {
              try {
                return (await fs.stat(path)).isDirectory();
              } catch {
                return false;
              }
            },
            readText: async (path) => {
              try {
                return await fs.readFile(path, 'utf8');
              } catch {
                return null;
              }
            },
          },
          filePath,
        })
      : null;
    const record = heartbeatRecordOf({
      at: new Date(),
      repoPath: checkout?.repoPath,
      branch: checkout?.branch,
      filePath,
      language: vscode.window.activeTextEditor?.document.languageId,
      editing: edited,
    });

    edited = false;

    await reporter.report(record);
  };

  const interval = setInterval(() => void beat(), DEFAULT_HEARTBEAT_INTERVAL_MS);

  context.subscriptions.push({ dispose: () => clearInterval(interval) });
};

export const deactivate = () => {
  // The interval is disposed through the subscriptions, and an unsent heartbeat is deliberately
  // dropped: it covers at most half a minute, and holding it past a window closing would report time
  // in an editor that no longer exists.
};
