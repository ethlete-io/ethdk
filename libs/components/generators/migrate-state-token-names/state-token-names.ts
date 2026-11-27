export const STATE_TOKEN_RENAMES: Readonly<Record<string, string>> = {
  '--et-accordion-header-active-background': '--et-accordion-header-active',
  '--et-accordion-header-hover-background': '--et-accordion-header-hover',
  '--et-button-opacity-disabled': '--et-button-disabled-opacity',
  '--et-button-outline-active-background': '--et-button-outline-active',
  '--et-button-outline-hover-background': '--et-button-outline-hover',
  '--et-button-transparent-active-background': '--et-button-transparent-active',
  '--et-button-transparent-hover-background': '--et-button-transparent-hover',
  '--et-button-variant-opacity-active-delta': '--et-button-variant-active-opacity-delta',
  '--et-button-variant-opacity-focus-delta': '--et-button-variant-focus-opacity-delta',
  '--et-button-variant-opacity-hover-delta': '--et-button-variant-hover-opacity-delta',
  '--et-carousel-dot-active-color': '--et-carousel-dot-active',
  '--et-carousel-dot-hover-color': '--et-carousel-dot-hover',
  '--et-carousel-dot-pressed-color': '--et-carousel-dot-pressed',
  '--et-checkbox-opacity-disabled': '--et-checkbox-disabled-opacity',
  '--et-checkbox-option-opacity-disabled': '--et-checkbox-option-disabled-opacity',
  '--et-chip-opacity-disabled': '--et-chip-disabled-opacity',
  '--et-dropzone-opacity-disabled': '--et-dropzone-disabled-opacity',
  '--et-form-field-control-border-color-focus': '--et-form-field-control-focus-border-color',
  '--et-form-field-control-border-color-hover': '--et-form-field-control-hover-border-color',
  '--et-form-field-label-color-active': '--et-form-field-label-active-color',
  '--et-form-field-value-color-active': '--et-form-field-value-active-color',
  '--et-pagination-item-border-color-hover': '--et-pagination-item-hover-border-color',
  '--et-radio-opacity-disabled': '--et-radio-disabled-opacity',
  '--et-scrollbar-thumb-active-color': '--et-scrollbar-thumb-active',
  '--et-segmented-button-hover-fill': '--et-segmented-button-hover',
  '--et-segmented-button-opacity-disabled': '--et-segmented-button-disabled-opacity',
  '--et-select-option-background-active': '--et-select-option-active',
  '--et-select-option-background-hover': '--et-select-option-hover',
  '--et-select-option-color-active': '--et-select-option-active-color',
  '--et-select-option-color-hover': '--et-select-option-hover-color',
  '--et-select-option-color-selected': '--et-select-option-selected-color',
  '--et-select-option-outline-color-active': '--et-select-option-active-outline-color',
  '--et-select-panel-action-background-hover': '--et-select-panel-action-hover',
  '--et-switch-opacity-disabled': '--et-switch-disabled-opacity',
  '--et-tab-hover-underline-opacity': '--et-tab-underline-hover-opacity',
  '--et-table-opacity-disabled': '--et-table-disabled-opacity',
  '--et-table-row-hover-background': '--et-table-row-hover',
  '--et-window-control-button-close-background-active': '--et-window-control-button-close-active',
};

const SCANNED = /\.(css|scss|sass|less|html|ts)$/;

const OLD_NAME = new RegExp(
  `(?<![\\w-])(${Object.keys(STATE_TOKEN_RENAMES)
    .sort((a, b) => b.length - a.length)
    .join('|')})(?![\\w-])`,
  'g',
);

export const isStateTokenCandidate = (filePath: string) => SCANNED.test(filePath) && !filePath.endsWith('.d.ts');

/** Returns the content with every old state token name renamed, or `null` when it holds none. */
export const renameStateTokens = (content: string): string | null => {
  if (!content.includes('--et-')) return null;

  const next = content.replace(OLD_NAME, (name) => STATE_TOKEN_RENAMES[name] ?? name);

  return next === content ? null : next;
};
