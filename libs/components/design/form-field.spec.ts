import { formField } from './form-field';
import { select } from './select';

const hostOf = (variant?: 'default' | 'ghost') => {
  const root = document.createElement('div');
  root.innerHTML = formField({
    control: select({ options: [{ value: 'a', label: 'A' }], value: 'a' }),
    variant,
  });

  return root.querySelector('.et-form-field') as Element;
};

describe('formField variant', () => {
  it('marks the host with data-variant ghost', () => {
    expect(hostOf('ghost').getAttribute('data-variant')).toBe('ghost');
  });

  it('leaves the attribute off by default', () => {
    expect(hostOf().hasAttribute('data-variant')).toBe(false);
    expect(hostOf('default').hasAttribute('data-variant')).toBe(false);
  });
});
