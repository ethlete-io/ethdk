import { createCategoryLabelStride, estimateCategoryLabelSpacing } from './chart-label-thinning';

describe('createCategoryLabelStride', () => {
  it('shows every label when each band has the room', () => {
    expect(createCategoryLabelStride(40, 40)).toBe(1);
    expect(createCategoryLabelStride(60, 40)).toBe(1);
  });

  it('shows every nth label so that shown labels are at least the spacing apart', () => {
    expect(createCategoryLabelStride(20, 40)).toBe(2);
    expect(createCategoryLabelStride(10, 45)).toBe(5);
    expect(createCategoryLabelStride(300 / 31, 40)).toBe(5);
  });

  it('does not round an exact multiple up', () => {
    expect(createCategoryLabelStride(0.1, 1.1)).toBe(11);
  });

  it('shows every label for a zero spacing or before the plot has a width', () => {
    expect(createCategoryLabelStride(5, 0)).toBe(1);
    expect(createCategoryLabelStride(0, 40)).toBe(1);
    expect(createCategoryLabelStride(NaN, 40)).toBe(1);
  });
});

describe('estimateCategoryLabelSpacing', () => {
  it('sizes side-by-side labels by the longest one', () => {
    expect(estimateCategoryLabelSpacing(['Jan', 'February'], 'horizontal')).toBe(8 * 7 + 12);
  });

  it('keeps a floor for short labels and a ceiling for long ones', () => {
    expect(estimateCategoryLabelSpacing(['1', '2'], 'horizontal')).toBe(24);
    expect(estimateCategoryLabelSpacing(['United Athletic Football Club'], 'horizontal')).toBe(96);
    expect(estimateCategoryLabelSpacing([], 'horizontal')).toBe(24);
  });

  it('spaces stacked labels by one line, whatever their length', () => {
    expect(estimateCategoryLabelSpacing(['United Athletic Football Club'], 'vertical')).toBe(20);
  });
});
