import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import { EMPTY, merge, switchMap, timer } from 'rxjs';
import { injectHostPorts } from '../../host';
import { injectApprovalQueue } from '../agent/approval-queue';
import { receiveSharedApprovals$, sendSharedApprovals$ } from './shared-approvals';

const RECEIVE_EVERY_MS = 30_000;

const SHARED_APPROVALS_DEF = /* @__PURE__ */ defineRootProvider(() => {
  const ports = injectHostPorts();
  const approvals = injectApprovalQueue();
  const queue$ = toObservable(approvals.items);

  toObservable(approvals.isLoaded)
    .pipe(
      switchMap((loaded) =>
        loaded
          ? merge(
              receiveSharedApprovals$({
                tick$: timer(0, RECEIVE_EVERY_MS),
                received$: () => ports.peers.receivedApprovals$(),
                merge: approvals.mergePeers,
              }),
              sendSharedApprovals$({
                queue$,
                send$: ports.peers.setSharedApprovals$,
              }),
            )
          : EMPTY,
      ),
      takeUntilDestroyed(),
    )
    .subscribe();

  return {};
});

export const injectSharedApprovals = /* @__PURE__ */ toInjectFn(SHARED_APPROVALS_DEF);
