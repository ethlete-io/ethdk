import { isFormInputTarget } from './form-input-target';

describe('isFormInputTarget', () => {
  it('matches the native form input elements', () => {
    expect(isFormInputTarget(document.createElement('input'))).toBe(true);
    expect(isFormInputTarget(document.createElement('textarea'))).toBe(true);
    expect(isFormInputTarget(document.createElement('select'))).toBe(true);
  });

  it('matches an element inside a contenteditable region', () => {
    const host = document.createElement('div');
    host.setAttribute('contenteditable', 'true');
    const child = document.createElement('span');
    host.appendChild(child);

    expect(isFormInputTarget(host)).toBe(true);
    expect(isFormInputTarget(child)).toBe(true);
  });

  it('does not match an element that opts back out of an editable region', () => {
    const host = document.createElement('div');
    host.setAttribute('contenteditable', 'false');

    expect(isFormInputTarget(host)).toBe(false);
  });

  it('does not match other elements or a missing target', () => {
    expect(isFormInputTarget(document.createElement('button'))).toBe(false);
    expect(isFormInputTarget(document.createElement('div'))).toBe(false);
    expect(isFormInputTarget(null)).toBe(false);
  });
});
