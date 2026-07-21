import { isTargetInsideOverlayTree } from './get-closest-overlay';
import { OverlayRef } from './overlay-ref';

// Minimal OverlayRef stand-ins — the helper only reads `elements.paneElement` and `config.origin`.
const fakeOverlay = (paneElement: HTMLElement, origin: HTMLElement | Event | undefined): OverlayRef<object, unknown> =>
  ({ elements: { paneElement }, config: { origin } }) as unknown as OverlayRef<object, unknown>;

describe('isTargetInsideOverlayTree', () => {
  let rootPane: HTMLElement;

  beforeEach(() => {
    rootPane = document.createElement('div');
    document.body.appendChild(rootPane);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('returns true for a target inside the root pane', () => {
    const inner = document.createElement('span');
    rootPane.appendChild(inner);

    expect(isTargetInsideOverlayTree({ target: inner, rootPane, openOverlays: [] })).toBe(true);
  });

  it('returns false for a target with no relation to any pane', () => {
    const outside = document.createElement('span');
    document.body.appendChild(outside);

    expect(isTargetInsideOverlayTree({ target: outside, rootPane, openOverlays: [] })).toBe(false);
  });

  it('treats a nested overlay anchored from inside the root pane as inside', () => {
    // the nested popover's trigger lives inside the root pane
    const trigger = document.createElement('button');
    rootPane.appendChild(trigger);

    // its pane mounts as a sibling in the DOM (portaled), not a descendant
    const nestedPane = document.createElement('div');
    document.body.appendChild(nestedPane);
    const nestedTarget = document.createElement('span');
    nestedPane.appendChild(nestedTarget);

    const openOverlays = [fakeOverlay(nestedPane, trigger)];

    expect(isTargetInsideOverlayTree({ target: nestedTarget, rootPane, openOverlays })).toBe(true);
  });

  it('resolves nesting several levels deep', () => {
    const firstTrigger = document.createElement('button');
    rootPane.appendChild(firstTrigger);

    const firstPane = document.createElement('div');
    document.body.appendChild(firstPane);
    const secondTrigger = document.createElement('button');
    firstPane.appendChild(secondTrigger);

    const secondPane = document.createElement('div');
    document.body.appendChild(secondPane);
    const deepTarget = document.createElement('span');
    secondPane.appendChild(deepTarget);

    const openOverlays = [fakeOverlay(firstPane, firstTrigger), fakeOverlay(secondPane, secondTrigger)];

    expect(isTargetInsideOverlayTree({ target: deepTarget, rootPane, openOverlays })).toBe(true);
  });

  it('ignores an unrelated overlay anchored outside the tree', () => {
    const unrelatedTrigger = document.createElement('button');
    document.body.appendChild(unrelatedTrigger);

    const unrelatedPane = document.createElement('div');
    document.body.appendChild(unrelatedPane);
    const unrelatedTarget = document.createElement('span');
    unrelatedPane.appendChild(unrelatedTarget);

    const openOverlays = [fakeOverlay(unrelatedPane, unrelatedTrigger)];

    expect(isTargetInsideOverlayTree({ target: unrelatedTarget, rootPane, openOverlays })).toBe(false);
  });

  it('resolves an Event origin via its target', () => {
    const trigger = document.createElement('button');
    rootPane.appendChild(trigger);
    const event = new MouseEvent('click');
    Object.defineProperty(event, 'target', { value: trigger });

    const nestedPane = document.createElement('div');
    document.body.appendChild(nestedPane);
    const nestedTarget = document.createElement('span');
    nestedPane.appendChild(nestedTarget);

    const openOverlays = [fakeOverlay(nestedPane, event)];

    expect(isTargetInsideOverlayTree({ target: nestedTarget, rootPane, openOverlays })).toBe(true);
  });
});
