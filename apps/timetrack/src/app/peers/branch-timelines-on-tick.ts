import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import { readBranchTimelines$ } from '@ethlete/timetrack';
import { map, timer } from 'rxjs';
import { injectHostPorts } from '../../host';
import { injectGitCollector } from '../../collectors';
import { sendBranchTimelines$ } from './branch-timelines';

const READ_EVERY_MS = 10 * 60_000;

const BRANCH_TIMELINES_DEF = /* @__PURE__ */ defineRootProvider(() => {
  const ports = injectHostPorts();
  const git = injectGitCollector();

  sendBranchTimelines$({
    tick$: timer(0, READ_EVERY_MS),
    ownKeys$: () => ports.peers.receivedSettings$().pipe(map((received) => received.ownRepoKeys)),
    read$: (keys) =>
      readBranchTimelines$({ processes: ports.processes, keys, worktrees: git.worktrees(), now: new Date() }),
    send$: ports.peers.setBranchTimelines$,
  })
    .pipe(takeUntilDestroyed())
    .subscribe();

  return {};
});

export const injectBranchTimelines = /* @__PURE__ */ toInjectFn(BRANCH_TIMELINES_DEF);
