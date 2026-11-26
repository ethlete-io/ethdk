import { atom, update } from 'claude-code';
import type { Register } from 'claude-code';

import { formatUsage, statusTextOf } from './format';

const usage = atom({ plugin: 'usage-line', key: 'usage' } as const, null);

export const register: Register = (on) => {
  on('session.measure', async ($, e, next) => {
    const text = formatUsage(e.rateLimits) ?? null;
    await update($, usage, () => text).catch(() => undefined);
    return next(e);
  });

  on('ui.render', { component: 'StatusLine' }, async ($, e, next) => {
    const text = (await $.state.get({ plugin: 'usage-line', key: 'usage' } as const)).value;
    return next({ ...e, props: { ...e.props, text: statusTextOf(e.props.text, text ?? null) } });
  });
};
