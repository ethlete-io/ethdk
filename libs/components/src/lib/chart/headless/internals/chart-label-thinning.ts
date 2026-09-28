const LABEL_CHAR_WIDTH = 7;
const LABEL_PADDING = 12;
const MIN_AUTO_SPACING = 24;
const MAX_AUTO_SPACING = 96;
const STACKED_LABEL_SPACING = 20;
const STRIDE_EPSILON = 1e-9;

export const estimateCategoryLabelSpacing = (texts: readonly string[], direction: 'horizontal' | 'vertical') => {
  if (direction === 'vertical') return STACKED_LABEL_SPACING;

  const longest = texts.reduce((max, text) => Math.max(max, [...text].length), 0);

  return Math.min(MAX_AUTO_SPACING, Math.max(MIN_AUTO_SPACING, longest * LABEL_CHAR_WIDTH + LABEL_PADDING));
};

export const createCategoryLabelStride = (step: number, spacing: number) => {
  if (!(step > 0) || !(spacing > 0)) return 1;

  return Math.max(1, Math.ceil(spacing / step - STRIDE_EPSILON));
};
