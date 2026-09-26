import { Signal } from '@angular/core';
import { BearerAuthSessionEndCause } from '../bearer-auth-provider';

/** One call of the provider's `logout`. A fresh object per call, so two logouts in one flush stay two. */
export type SessionEndEvent = {
  cause: BearerAuthSessionEndCause;
  fromOtherTab: boolean;
};

const sessionEnds = /* @__PURE__ */ new WeakMap<object, Signal<SessionEndEvent | null>>();

export const registerSessionEnd = (owner: object, sessionEnd: Signal<SessionEndEvent | null>) => {
  sessionEnds.set(owner, sessionEnd);
};

export const readSessionEnd = (owner: object) => sessionEnds.get(owner) ?? null;
