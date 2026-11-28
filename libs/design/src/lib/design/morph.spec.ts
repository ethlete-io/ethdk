// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { morph } from '../../../design/morph';

const mount = (markup: string) => {
  const root = document.createElement('div');

  root.innerHTML = markup;
  document.body.replaceChildren(root);

  return root;
};

describe('morph', () => {
  it('keeps a matching element and changes only its classes, attributes and text', () => {
    const root = mount('<section class="panel" aria-expanded="false" data-old><h2>Closed</h2></section>');
    const panel = root.querySelector('section');
    const title = root.querySelector('h2');

    morph(root, '<section class="panel panel--open" aria-expanded="true"><h2>Open</h2></section>');

    expect(root.querySelector('section')).toBe(panel);
    expect(root.querySelector('h2')).toBe(title);
    expect(panel?.className).toBe('panel panel--open');
    expect(panel?.getAttribute('aria-expanded')).toBe('true');
    expect(panel?.hasAttribute('data-old')).toBe(false);
    expect(title?.textContent).toBe('Open');
  });

  it('inserts a node that appears and removes one that goes, keeping its siblings', () => {
    const root = mount('<button>toggle</button><span class="hint">closed</span><footer>end</footer>');
    const button = root.querySelector('button');
    const footer = root.querySelector('footer');

    morph(root, '<button>toggle</button><p class="body">filled</p><footer>end</footer>');

    expect(root.querySelector('button')).toBe(button);
    expect(root.querySelector('footer')).toBe(footer);
    expect(root.querySelector('.hint')).toBeNull();
    expect(root.querySelector('.body')?.isConnected).toBe(true);
    expect(root.innerHTML).toBe('<button>toggle</button><p class="body">filled</p><footer>end</footer>');
  });

  it('matches by id, so an element with another id is replaced, not reused', () => {
    const root = mount('<div id="a">a</div><div id="b">b</div>');
    const b = root.querySelector('#b');

    morph(root, '<div id="b">b</div>');

    expect(root.querySelector('#b')).toBe(b);
    expect(root.querySelector('#a')).toBeNull();
  });

  it('keeps the value a user typed into a kept field', () => {
    const root = mount('<input name="q" class="field">');
    const input = root.querySelector('input');

    if (input) input.value = 'typed';
    morph(root, '<input name="q" class="field field--wide">');

    expect(root.querySelector('input')).toBe(input);
    expect(input?.value).toBe('typed');
  });
});
