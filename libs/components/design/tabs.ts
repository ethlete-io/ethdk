import { interactiveStyles } from '@ethlete/core/design/interactive-styles';
import focusRing from '../src/lib/focus-ring/focus-ring-styles.component.css?inline';
import scrollable from '../src/lib/scrollable/scrollable.component.css?inline';
import tabBar from '../src/lib/tabs/tab-bar-styles.component.css?inline';
import tabScale from '../src/lib/tabs/tab-scale-styles.component.css?inline';
import tabGroup from '../src/lib/tabs/tabs/tab-group.component.css?inline';

export type TabsMockTab = {
  label: string;
  disabled?: boolean;
};

export type TabsMockOptions = {
  tabs: TabsMockTab[];
  /** The index of the selected tab. Defaults to 0. */
  selected?: number;
  /** Defaults to `md`. */
  size?: 'sm' | 'md' | 'lg';
  /** Defaults to `secondary`. */
  variant?: 'primary' | 'secondary';
  /** Defaults to `horizontal`. */
  orientation?: 'horizontal' | 'vertical';
  /** Defaults to `true`: the baseline under the bar. */
  divider?: boolean;
  /** The text of the selected tab's panel. Left out, the group draws no panel. */
  panel?: string;
  /** Unique per frame: the trigger and panel ids derive from it. */
  id?: string;
  /** Extra attributes on a trigger's element, by tab index, e.g. design markers. */
  triggerAttributes?: Record<number, string>;
};

/** The stylesheets `tabs()` draws with: the real `et-tab-group` CSS. */
export const tabsStyles = /* @__PURE__ */ [interactiveStyles, focusRing, scrollable, tabScale, tabBar, tabGroup].join(
  '\n',
);

/** Draws `<et-tab-group>` as HTML, with the DOM the component renders after its first frame. */
export const tabs = (options: TabsMockOptions) => {
  const { id = 'tabs', selected = 0, orientation = 'horizontal' } = options;

  const triggers = options.tabs
    .map((tab, index) => {
      const isSelected = index === selected;
      const attributes = [
        options.triggerAttributes?.[index],
        `id="et-tab-${id}-${index}"`,
        'role="tab"',
        `aria-selected="${isSelected}"`,
        `aria-controls="et-tab-panel-${id}-${index}"`,
        tab.disabled && 'aria-disabled="true" disabled',
        `tabindex="${isSelected ? 0 : -1}"`,
        `class="${['et-tab-group__trigger', 'et-surface-interactive', 'et-focus-ring', isSelected && 'et-tab-group__trigger--active', tab.disabled && 'et-tab-group__trigger--disabled'].filter(Boolean).join(' ')}"`,
      ].filter(Boolean);

      return `<button ${attributes.join(' ')}><span class="et-tab-group__trigger-content">${tab.label}</span><span class="et-tab-bar-underline${isSelected ? ' et-tab-bar-underline--active' : ''}"></span></button>`;
    })
    .join('');

  const panel =
    options.panel === undefined
      ? ''
      : `<div class="et-tab-group__body"><div id="et-tab-panel-${id}-${selected}" aria-labelledby="et-tab-${id}-${selected}" class="et-tab-group__panel" role="tabpanel">${options.panel}</div></div>`;

  const hostAttributes = [
    'class="et-tab-group et-tab-scale"',
    `data-orientation="${orientation}"`,
    `data-size="${options.size ?? 'md'}"`,
    'data-fit="auto"',
    `data-divider="${options.divider ?? true}"`,
    `data-variant="${options.variant ?? 'secondary'}"`,
  ];

  return `<et-tab-group ${hostAttributes.join(' ')}><div aria-orientation="${orientation}" class="et-tab-group__header-shell" role="tablist"><et-scrollable class="et-scrollable et-tab-group__header-scrollable" direction="${orientation}" item-size="auto" role="presentation"><div class="et-scrollable-wrapper" role="presentation"><div class="et-scrollable-container et-tab-group__header" role="presentation">${triggers}</div></div></et-scrollable></div>${panel}</et-tab-group>`;
};
