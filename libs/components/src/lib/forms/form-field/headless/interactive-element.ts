/** Tag names that are natively interactive - a click on one is the control's own, not the frame's. */
export const INTERACTIVE_TAGS = ['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'];

/**
 * Whether `element` is (or behaves as) a natively-interactive control. Shared by every control
 * that opens a panel on a frame click (select, cascader) and by the form-field's own frame
 * activation, so they all treat the same set of elements as "hands off" - including `SELECT` and
 * `contenteditable`, which hand-rolled tag lists kept missing.
 */
export const isInteractiveElement = (element: HTMLElement) =>
  INTERACTIVE_TAGS.includes(element.tagName) || element.isContentEditable;
