import { describe, expect, it } from 'vitest';
import { definePart, forceInteraction, interactionRows } from '../../../design/define-part';
import { shotStateNamesOf } from './shot-command';

type Props = {
  os: 'linux' | 'windows';
  force?: { control: 'update' | 'maximize'; interaction: 'hover' | 'active' | 'focus-visible' };
};

const rowOf = (name: string, props: Props, control: 'update' | 'maximize') =>
  interactionRows<Props, string, 'hover' | 'active' | 'focus-visible'>(
    { [name]: props },
    {
      interactions: ['hover', 'active', 'focus-visible'],
      force: (rest, interaction) => ({ ...rest, force: { control, interaction } }),
    },
  );

const titleBar = () => {
  const linux = rowOf('linux-full-update', { os: 'linux' }, 'update');
  const windows = rowOf('windows', { os: 'windows' }, 'maximize');
  const mark = (control: string, markup: string, { force }: Props) => {
    const marked = markup.replace(/^<button/u, `<button data-et-control="${control}"`);

    return force?.control === control ? forceInteraction(marked, force.interaction) : marked;
  };

  return definePart({
    note: 'a title-bar-like part',
    states: { ...linux.states, ...windows.states },
    grid: { columns: ['rest', 'hover', 'active', 'focus-visible'], rows: { ...linux.grid.rows, ...windows.grid.rows } },
    render: (props: Props) => ({
      body:
        props.os === 'linux'
          ? mark('update', '<button et-button class="tb-update" type="button">Update</button>', props)
          : mark('maximize', '<button data-et-ng et-button type="button" size="xs"></button>', props),
    }),
  } as never);
};

describe('shotStateNamesOf', () => {
  it('draws the hover, active and focus-visible cells of a row the grid leaves out as unchanged', async () => {
    const part = titleBar();

    expect(await shotStateNamesOf(part)).toContain('windows-hover');
    expect(await shotStateNamesOf(part)).toEqual(expect.arrayContaining(['windows-focus-visible', 'windows-active']));
  });

  it('keeps the drawn states and invents none', async () => {
    const names = await shotStateNamesOf(titleBar());

    expect(names).toContain('linux-full-update-hover');
    expect(names).not.toContain('nope');
  });
});
