import { TestBed } from '@angular/core/testing';
import { injectRenderer } from './renderer';

describe('renderer', () => {
  const renderer = () => TestBed.runInInjectionContext(() => injectRenderer());
  const el = () => document.createElement('div');

  it('adds and removes several classes', () => {
    const r = renderer();
    const node = el();

    r.addClass(node, 'a', 'b');
    expect(node.className).toBe('a b');

    r.removeClass(node, 'a');
    expect(node.className).toBe('b');
  });

  it('toggles a class and honours force', () => {
    const r = renderer();
    const node = el();

    expect(r.toggleClass(node, 'a')).toBe(true);
    expect(r.toggleClass(node, 'a')).toBe(false);
    expect(r.toggleClass(node, 'a', false)).toBe(false);
    expect(r.toggleClass(node, 'a', true)).toBe(true);
    expect(node.classList.contains('a')).toBe(true);
  });

  it('sets a style and removes it on null or undefined', () => {
    const r = renderer();
    const node = el();

    r.setStyle(node, { color: 'red', width: '10px' });
    expect(node.style.color).toBe('red');

    r.setStyle(node, { color: null, width: undefined as unknown as null });
    expect(node.style.color).toBe('');
    expect(node.style.width).toBe('');
  });

  it('sets and removes css custom properties', () => {
    const r = renderer();
    const node = el();

    r.setCssProperties(node, { '--a': '1', '--b': '2' });
    expect(node.style.getPropertyValue('--a')).toBe('1');

    r.setCssProperty(node, '--a', null);
    expect(node.style.getPropertyValue('--a')).toBe('');
    expect(node.style.getPropertyValue('--b')).toBe('2');
  });

  it('removes an attribute when the value is null and prefixes data attributes', () => {
    const r = renderer();
    const node = el();

    r.setAttributes(node, { role: 'button', title: 't' });
    r.setAttribute(node, 'title', null);
    r.setDataAttributes(node, { size: 'lg' });

    expect(node.hasAttribute('title')).toBe(false);
    expect(node.getAttribute('role')).toBe('button');
    expect(node.getAttribute('data-size')).toBe('lg');
  });

  it('empties an element and replaces a child', () => {
    const r = renderer();
    const parent = el();
    const a = el();
    const b = el();
    r.appendChild(parent, a);

    r.replaceChild(parent, b, a);
    expect(Array.from(parent.children)).toEqual([b]);

    r.empty(parent);
    expect(parent.childNodes).toHaveLength(0);
  });

  it('falls back to insertBefore when moveBefore throws', () => {
    const r = renderer();
    const parent = el();
    const child = el();
    Object.assign(parent, {
      moveBefore: () => {
        throw new Error('nope');
      },
    });

    r.moveBefore({ newParent: parent, child });

    expect(child.parentNode).toBe(parent);
  });

  it('returns an unlisten function from listen', () => {
    const r = renderer();
    const node = el();
    const spy = vi.fn();

    const off = r.listen(node, 'click', spy);
    node.click();
    off();
    node.click();

    expect(spy).toHaveBeenCalledTimes(1);
  });
});
