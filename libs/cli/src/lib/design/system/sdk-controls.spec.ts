// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { SDK_CONTROLS } from './complete';

const isSdkControl = (html: string) => {
  document.body.innerHTML = html;

  return document.body.firstElementChild?.matches(SDK_CONTROLS.join(', ')) ?? false;
};

describe('SDK_CONTROLS', () => {
  it('counts a removable or selectable chip as a control, a static chip not', () => {
    expect(isSdkControl('<et-chip class="et-chip" data-removable="true">A</et-chip>')).toBe(true);
    expect(isSdkControl('<et-chip etSelectionOption role="checkbox">A</et-chip>')).toBe(true);
    expect(isSdkControl('<et-chip class="et-chip">3 ungepusht</et-chip>')).toBe(false);
  });
});
