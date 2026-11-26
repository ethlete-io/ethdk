export const FARN_PRODUCT = 'farn';

export const FARN_PART = 'quantity-stepper';

export const FARN_TREE = {
  layers: [
    { title: 'Foundations', open: false, parts: [] },
    {
      title: 'Components',
      open: true,
      parts: [
        { name: 'shop-bar', leaf: true },
        { name: 'product-card' },
        { name: 'pot-picker', warns: true },
        { name: FARN_PART, selected: true, states: [{ name: 'grid' }, { name: 'stepper' }] },
      ],
    },
    { title: 'Elements', open: false, parts: [] },
    { title: 'Pages', open: false, parts: [] },
  ],
};
