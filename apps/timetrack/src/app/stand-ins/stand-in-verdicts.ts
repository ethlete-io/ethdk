import { defineRootProvider, toInjectFn } from '@ethlete/core';
import { createStandInVerdictLog } from '@ethlete/timetrack';

const STAND_IN_VERDICTS_DEF = /* @__PURE__ */ defineRootProvider(() => createStandInVerdictLog());

export const injectStandInVerdicts = /* @__PURE__ */ toInjectFn(STAND_IN_VERDICTS_DEF);
