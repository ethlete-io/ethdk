import { menu } from './menu';

const deleteRow = (errorColor?: string) => {
  const root = document.createElement('div');
  root.innerHTML = menu({ rows: [{ label: 'Delete', destructive: true }], errorColor });

  return root.querySelector('[data-variant="destructive"]') as Element;
};

describe('menu destructive item', () => {
  it('draws in the error color theme', () => {
    expect(deleteRow('danger').classList).toContain('et-color--danger');
    expect(deleteRow('danger').classList).not.toContain('et-color--inherited');
  });

  it('inherits the color without errorColor', () => {
    expect(deleteRow().classList).toContain('et-color--inherited');
  });
});
