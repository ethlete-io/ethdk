import { vi } from 'vitest';
import { overlayViewportInsets } from '../../../libs/core/src/index';
import { ListenerRecord } from './listeners';

export type InvariantName =
  | 'timers'
  | 'frames'
  | 'observers'
  | 'listeners'
  | 'overlay-roots'
  | 'body'
  | 'head'
  | 'viewport-insets'
  | 'errors'
  | 'warnings';

export type ScenarioErrorEntry = {
  source: 'ErrorHandler' | 'console.error';
  error: unknown;
};

export type ScenarioWarningEntry = {
  source: 'console.warn';
  warning: unknown;
};

export type InvariantCheckContext = {
  pendingFrames: number;
  observedElements: readonly Element[];
  listeners: readonly ListenerRecord[];
  initialBodyChildren: ReadonlySet<Element>;
  initialHeadChildren: ReadonlySet<Element>;
  errors: readonly ScenarioErrorEntry[];
  warnings: readonly ScenarioWarningEntry[];
  allowed: ReadonlySet<InvariantName>;
};

const VIEWPORT_INSET_PROPERTIES = [
  '--et-viewport-inset-top',
  '--et-viewport-inset-right',
  '--et-viewport-inset-bottom',
  '--et-viewport-inset-left',
] as const;

const describeElement = (element: Element) => {
  const classes = element.classList.length ? `.${Array.from(element.classList).join('.')}` : '';

  return `<${element.tagName.toLowerCase()}${classes}>`;
};

const describeListener = (record: ListenerRecord) =>
  `${record.target} "${record.type}"${record.capture ? ' (capture)' : ''}${record.once ? ' (once)' : ''}`;

export const checkInvariants = (ctx: InvariantCheckContext) => {
  const failures: string[] = [];
  const check = (name: InvariantName, failure: string | null) => {
    if (failure && !ctx.allowed.has(name)) failures.push(`${name}: ${failure}`);
  };

  const timerCount = vi.getTimerCount();
  check('timers', timerCount > 0 ? `${timerCount} timer(s) leaked` : null);

  check('frames', ctx.pendingFrames > 0 ? `${ctx.pendingFrames} animation frame request(s) still pending` : null);

  check(
    'observers',
    ctx.observedElements.length
      ? `${ctx.observedElements.length} element(s) still observed by an IntersectionObserver: ${ctx.observedElements.map(describeElement).join(', ')}`
      : null,
  );

  check(
    'listeners',
    ctx.listeners.length
      ? `${ctx.listeners.length} listener(s) left on document/window: ${ctx.listeners.map(describeListener).join(', ')}`
      : null,
  );

  const roots = Array.from(document.querySelectorAll('.et-overlay-runtime-root'));
  check(
    'overlay-roots',
    roots.length
      ? `${roots.length} .et-overlay-runtime-root node(s) left with ${roots.map((root) => root.childElementCount).join(', ')} child(ren)`
      : null,
  );

  const extraChildren = Array.from(document.body.children).filter((child) => !ctx.initialBodyChildren.has(child));
  check(
    'body',
    extraChildren.length
      ? `${extraChildren.length} body child(ren) added and left: ${extraChildren.map(describeElement).join(', ')}`
      : null,
  );

  const extraHeadChildren = Array.from(document.head.children).filter((child) => !ctx.initialHeadChildren.has(child));
  check(
    'head',
    extraHeadChildren.length
      ? `${extraHeadChildren.length} head child(ren) added and left: ${extraHeadChildren.map(describeElement).join(', ')}`
      : null,
  );

  const insets = overlayViewportInsets(Number.NEGATIVE_INFINITY);
  const publishedInsets = VIEWPORT_INSET_PROPERTIES.filter((property) =>
    document.documentElement.style.getPropertyValue(property),
  );
  check(
    'viewport-insets',
    Object.values(insets).some((value) => value !== 0) || publishedInsets.length
      ? `reservations still active: ${JSON.stringify(insets)}, published: ${publishedInsets.join(', ') || 'none'}`
      : null,
  );

  check(
    'errors',
    ctx.errors.length
      ? `${ctx.errors.length} unexpected error(s):\n${ctx.errors.map((entry) => `[${entry.source}] ${String(entry.error)}`).join('\n')}`
      : null,
  );

  check(
    'warnings',
    ctx.warnings.length
      ? `${ctx.warnings.length} unexpected warning(s):\n${ctx.warnings.map((entry) => String(entry.warning)).join('\n')}`
      : null,
  );

  if (failures.length) throw new Error(`Scenario invariants failed:\n${failures.join('\n')}`);
};
