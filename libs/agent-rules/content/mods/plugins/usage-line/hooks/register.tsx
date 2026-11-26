import type { Register } from 'claude-code';

import { formatUsage } from './format';

export const register: Register = (on) => {
  on('session.measure', ($, e, next) => {
    $.ui.status(formatUsage(e.rateLimits));
    return next(e);
  });
};
