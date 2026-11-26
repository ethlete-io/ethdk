import floatingActionBase from '../src/lib/floating-action/floating-action-styles.component.css?inline';
import { FILTER_ICON } from '../src/lib/icon/headless/filter-icon';
import iconBase from '../src/lib/icon/headless/icon-styles.component.css?inline';
import { button, buttonStyles, ButtonMockOptions } from './button';
import { iconMarkup } from './icon';

export type FloatingActionMockOptions = {
  /** The trigger, drawn as an `et-button`. */
  trigger: ButtonMockOptions;
  /** Draws the filter icon in the trigger, as the story's Filter button could carry. */
  filterIcon?: boolean;
  /** Where the trigger is. Left out, `inline`. */
  state?: 'inline' | 'floating' | 'hidden';
  /** The in-flow size the anchor holds while the trigger is out of the flow, in px. */
  heldSize?: { inlineSize: number; blockSize: number };
  /** Extra attributes on the trigger, e.g. design markers. */
  triggerAttributes?: string;
  /** Content before the anchor, as HTML. */
  before?: string;
  /** The region the trigger acts on (`etFloatingActionScope`), as HTML. Left out, no scope. */
  scope?: string;
  /** Content after the scope, as HTML. */
  after?: string;
  /** Extra attributes on the host, e.g. a style or design markers. */
  attributes?: string;
};

/** The stylesheets `floatingAction()` draws with: the real floating-action, button and icon CSS. */
export const floatingActionStyles = /* @__PURE__ */ [buttonStyles, iconBase, floatingActionBase].join('\n');

/** Draws `[etFloatingAction]` with its anchor, trigger and scope as a static snapshot of one state. */
export const floatingAction = (options: FloatingActionMockOptions) => {
  const { state = 'inline', heldSize } = options;
  const trigger = button({
    ...options.trigger,
    icon: options.filterIcon ? iconMarkup(FILTER_ICON) : options.trigger.icon,
    class: ['et-floating-action-trigger', options.trigger.class].filter(Boolean).join(' '),
    style: [state !== 'inline' && 'animation: none; transition: none', options.trigger.style]
      .filter(Boolean)
      .join('; '),
  }).replace(
    /^<(button|a) /,
    `<$1 ${[options.triggerAttributes, `data-floating-action-state="${state}"`].filter(Boolean).join(' ')} `,
  );

  const held =
    state !== 'inline' && heldSize
      ? ` style="min-inline-size: ${heldSize.inlineSize}px; min-block-size: ${heldSize.blockSize}px"`
      : '';
  const anchor = `<div class="et-floating-action-anchor"${held}>${trigger}</div>`;
  const scope = options.scope === undefined ? '' : `<div class="et-floating-action-scope">${options.scope}</div>`;
  const host = [options.attributes, 'class="et-floating-action"', `data-state="${state}"`].filter(Boolean);

  return `<div ${host.join(' ')}>${options.before ?? ''}${anchor}${scope}${options.after ?? ''}</div>`;
};
