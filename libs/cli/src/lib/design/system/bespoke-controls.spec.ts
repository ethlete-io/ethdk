// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { BespokeControl, BESPOKE_CONTROLS_IN, composedControlsOf } from './bespoke-controls';

const bespokeControlsIn = (root: ParentNode, part: string, ids: string[]) =>
  (new Function(`return ${BESPOKE_CONTROLS_IN}`)() as (options: unknown) => BespokeControl[])({ root, part, ids });

const drawn = (inner: string) => {
  const root = document.createElement('div');

  root.innerHTML = `<div data-et-part="components/title-bar">${inner}</div>`;

  return root;
};

const ICON = '<svg data-et-part="foundations/icons" class="size-4"><path d="M4 8h8"></path></svg>';

describe('bespoke controls', () => {
  it('passes SDK components used through their props, with icons and embedded parts inside', () => {
    const root = drawn(
      `<button class="et-window-control-button et-focus-ring" data-et-control="close"><div class="et-window-control-button-icon">${ICON}</div></button>` +
        `<button class="et-button" data-et-control="update"><div class="et-button-contents">Update</div></button>` +
        `<div data-et-part="components/title-search"><button class="flex gap-2" data-et-control="search"></button></div>`,
    );

    expect(bespokeControlsIn(root, 'components/title-bar', ['close', 'update', 'search'])).toEqual([]);
  });

  it('names drawn markup, custom classes and drawn content', () => {
    const root = drawn(
      '<button class="flex h-6 rounded-sm" data-et-control="search"></button>' +
        '<button class="et-button tabular-nums" data-et-control="reset"></button>' +
        '<button class="et-button" data-et-control="open"><div class="et-button-contents"><span class="text-et-surface-muted">⌘K</span></div></button>',
    );

    expect(bespokeControlsIn(root, 'components/title-bar', ['search', 'reset', 'open'])).toEqual([
      { id: 'search', why: 'is drawn markup (button.flex.h-6.rounded-sm), no SDK component' },
      { id: 'reset', why: 'is an SDK component with the custom class tabular-nums' },
      { id: 'open', why: 'is an SDK component with drawn content (span.text-et-surface-muted)' },
    ]);
  });

  it('checks the own controls of a part with several controls and interaction states only', () => {
    const controls = {
      search: { kind: 'button', part: 'components/title-search' },
      minimize: { kind: 'button' },
      close: { kind: 'button' },
    };

    expect(composedControlsOf({ part: 'components/title-bar', controls, states: ['rest', 'close-hover'] })).toEqual([
      'minimize',
      'close',
    ]);
    expect(composedControlsOf({ part: 'components/title-bar', controls, states: ['rest', 'update'] })).toEqual([]);
    expect(
      composedControlsOf({
        part: 'components/title-search',
        controls: { search: { kind: 'button' } },
        states: ['hover'],
      }),
    ).toEqual([]);
    expect(composedControlsOf({ part: 'pages/system', controls, states: ['hover'] })).toEqual([]);
  });
  it('names the zoom chip reset button, whose tabular-nums class rides on the SDK button', () => {
    const chipButton = (id: string, extra = '') =>
      `<span class="contents" data-camera-${id}><button class="et-surface-interactive et-color-interactive et-button et-focus-ring et-color--surface${extra}" data-et-control="${id}" type="button" data-variant="transparent" data-size="sm"><div class="et-button-icon"></div><div class="et-button-contents">${id}</div></button></span>`;
    const root = document.createElement('div');

    root.innerHTML = `<div class="inline-flex" data-et-part="components/zoom-chip" data-canvas-zoom>${chipButton('out')}${chipButton('reset', ' tabular-nums')}${chipButton('in')}${chipButton('fit')}</div>`;

    const button = { kind: 'button', input: ['pointer', 'keyboard'] };
    const ids = composedControlsOf({
      part: 'components/zoom-chip',
      controls: { out: button, reset: button, in: button, fit: button },
      states: ['out-rest', 'out-hover', 'reset-active', 'fit-focus-visible'],
    });

    expect(ids).toEqual(['out', 'reset', 'in', 'fit']);
    expect(bespokeControlsIn(root, 'components/zoom-chip', ids)).toEqual([
      { id: 'reset', why: 'is an SDK component with the custom class tabular-nums' },
    ]);
  });
});
