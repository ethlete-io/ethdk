import { describe, expect, it } from 'vitest';
import { definePart, forceInteraction, interactionRows, ng } from '../../../../design/define-part';
import { gridOf } from './list-system';
import {
  drawnStateNamesOf,
  forcesOnlyUnchangedControls,
  skippedStatesLineOf,
  unchangedRowStatesOf,
} from './unchanged-rows';

type Control = 'restart' | 'later';
type Props = { force?: { control: Control; interaction: 'hover' | 'active' | 'focus-visible' } };

const rowOf = (name: Control) =>
  interactionRows<Props, Control, 'hover' | 'active' | 'focus-visible'>({ [name]: {} } as Record<Control, Props>, {
    interactions: ['hover', 'active', 'focus-visible'],
    force: (props, interaction) => ({ ...props, force: { control: name, interaction } }),
  });

const dialogOf = (laterButton: string) => {
  const restart = rowOf('restart');
  const later = rowOf('later');
  const mark = (name: Control, markup: string, { force }: Props) => {
    const marked = markup.replace(/^<button/u, `<button data-et-control="${name}"`);

    return force?.control === name ? forceInteraction(marked, force.interaction) : marked;
  };

  return definePart({
    note: 'an update-dialog-like part',
    states: { open: {}, ...restart.states, ...later.states },
    grid: { columns: restart.grid.columns, rows: { ...restart.grid.rows, ...later.grid.rows } },
    render: async (props: Props) => ({
      body: await ng(
        `<div class="flex gap-space-2">
          ${mark('later', laterButton, props)}
          ${mark('restart', '<button et-button type="button" variant="filled" size="xs">Neu starten</button>', props)}
        </div>`,
        { imports: ['BUTTON_IMPORTS'] },
      ),
      styles: '',
    }),
  });
};

const ROW_STATES = (row: Control) => [`${row}-hover`, `${row}-active`, `${row}-focus-visible`];

describe('unchangedRowStatesOf', () => {
  it('drops the interaction states of rows that force only plain SDK buttons', async () => {
    const part = dialogOf('<button et-button type="button" variant="outline" size="xs">Später</button>');

    expect([...(await unchangedRowStatesOf(part))].sort()).toEqual(
      [...ROW_STATES('later'), ...ROW_STATES('restart')].sort(),
    );
  });

  it('keeps the row of a button the part styles with its own classes', async () => {
    const part = dialogOf('<button et-button class="ud-later" type="button" size="xs">Später</button>');

    expect([...(await unchangedRowStatesOf(part))]).toEqual(ROW_STATES('restart'));
  });

  it('leaves the grid a rest cell for each dropped row, so it draws no state row', async () => {
    const part = dialogOf('<button et-button type="button" size="xs"><span class="ud-label">Später</span></button>');
    const names = await drawnStateNamesOf(part);

    expect(names).toEqual(['open', 'restart', 'later', ...ROW_STATES('later')]);
    expect(gridOf(part.grid, names).grid?.cells.filter((cell) => cell.row === 'restart')).toEqual([
      { row: 'restart', column: 'rest', state: 'restart' },
    ]);
  });
});

describe('skippedStatesLineOf', () => {
  it('names the skipped states, and prints nothing when compare draws them all', () => {
    expect(skippedStatesLineOf(['later-hover', 'later-active'])).toBe(
      'skipped 2 interaction states (unchanged SDK controls): later-hover, later-active',
    );
    expect(skippedStatesLineOf([])).toBeNull();
  });
});

describe('forcesOnlyUnchangedControls', () => {
  it('counts only SDK components rendered through ng()', () => {
    expect(forcesOnlyUnchangedControls('<button data-et-ng et-button data-et-force="hover">Go</button>')).toBe(true);
    expect(forcesOnlyUnchangedControls('<button et-button data-et-force="hover">Go</button>')).toBe(false);
    expect(forcesOnlyUnchangedControls('<et-chip data-et-ng data-et-force="hover" class="et-chip">A</et-chip>')).toBe(
      true,
    );
    expect(forcesOnlyUnchangedControls('<div data-et-ng class="x"></div>')).toBe(false);
  });

  it('treats a rule of the part stylesheet that selects the control as a change', () => {
    const caption =
      '<button data-et-ng et-window-control-button shape="caption" data-et-force="hover"><svg></svg></button>';
    const css = `@layer components {
      .et-window-control-button[data-shape='caption'] { width: 46px; @media (hover: hover) { &:hover { opacity: 1 } } }
    }`;

    expect(forcesOnlyUnchangedControls(caption)).toBe(true);
    expect(forcesOnlyUnchangedControls(caption, css)).toBe(false);
    expect(forcesOnlyUnchangedControls(caption.replace('caption', 'round'), css)).toBe(true);
    expect(forcesOnlyUnchangedControls(caption.replace(' shape="caption"', ''), css)).toBe(false);
    expect(forcesOnlyUnchangedControls(caption, '.et-button[data-variant="filled"] { color: red }')).toBe(true);
  });

  it('treats a wrapper that sets SDK vars or a semantic colour as a change', () => {
    const close = '<button data-et-ng et-window-control-button kind="close" data-et-force="hover"></button>';

    expect(forcesOnlyUnchangedControls(`<div data-et-ng class="flex"><span>x</span>${close}</div>`)).toBe(true);
    expect(forcesOnlyUnchangedControls(`<span data-et-ng data-et-semantic-color="error">${close}</span>`)).toBe(false);
    expect(
      forcesOnlyUnchangedControls(
        `<span data-et-ng class="contents [--et-window-control-button-close-background:red]">${close}</span>`,
      ),
    ).toBe(false);
    expect(forcesOnlyUnchangedControls(`<span data-et-semantic-color="error"></span>${close}`)).toBe(true);
  });

  it('treats an inline style or styled content as a change, but not icons or embedded parts', () => {
    expect(
      forcesOnlyUnchangedControls('<button data-et-ng et-button style="color: red" data-et-force="hover">Go</button>'),
    ).toBe(false);
    expect(
      forcesOnlyUnchangedControls(
        '<button data-et-ng et-button data-et-force="hover"><svg class="i"><path class="p"/></svg><span data-et-part="elements/icon" class="ic"><b class="x"></b></span>Go</button><span class="after"></span>',
      ),
    ).toBe(true);
  });
});
