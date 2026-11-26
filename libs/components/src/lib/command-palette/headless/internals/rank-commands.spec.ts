import { CommandPaletteCommand } from '../../command-palette.types';
import { groupResults, rankCommands } from './rank-commands';

const command = (parts: Partial<CommandPaletteCommand> & { label: string }): CommandPaletteCommand => ({
  id: parts.label,
  run: () => undefined,
  ...parts,
});

const labelsFor = (commands: CommandPaletteCommand[], query: string) =>
  rankCommands(commands, query).map((result) => result.command.label);

describe('rankCommands', () => {
  it('keeps every command when the query is empty', () => {
    const commands = [command({ label: 'Add user' }), command({ label: 'Delete row' })];

    expect(labelsFor(commands, '')).toEqual(['Add user', 'Delete row']);
  });

  it('treats a whitespace-only query as empty', () => {
    const commands = [command({ label: 'Add user' }), command({ label: 'Delete row' })];

    expect(labelsFor(commands, '   ')).toEqual(['Add user', 'Delete row']);
  });

  it('orders an unfiltered list by priority, highest first', () => {
    const commands = [
      command({ label: 'Rarely used' }),
      command({ label: 'Used constantly', priority: 10 }),
      command({ label: 'Used sometimes', priority: 5 }),
    ];

    expect(labelsFor(commands, '')).toEqual(['Used constantly', 'Used sometimes', 'Rarely used']);
  });

  it('drops commands the query does not match', () => {
    const commands = [command({ label: 'Add user' }), command({ label: 'Delete row' })];

    expect(labelsFor(commands, 'user')).toEqual(['Add user']);
  });

  it('ranks the better match first', () => {
    const commands = [command({ label: 'Unset serial' }), command({ label: 'Add user' })];

    expect(labelsFor(commands, 'user')).toEqual(['Add user', 'Unset serial']);
  });

  it('matches a keyword the label does not contain', () => {
    const commands = [command({ label: 'Remove row', keywords: ['delete', 'destroy'] })];

    expect(labelsFor(commands, 'delete')).toEqual(['Remove row']);
  });

  it('ranks a label match above an equally good keyword match', () => {
    const commands = [
      command({ label: 'Remove row', keywords: ['delete'] }),
      command({ label: 'Delete row', id: 'delete-row' }),
    ];

    expect(labelsFor(commands, 'delete')).toEqual(['Delete row', 'Remove row']);
  });

  it('marks the matched characters of the label, and nothing else', () => {
    const [result] = rankCommands([command({ label: 'Create table' })], 'table');

    expect(result?.segments).toEqual([
      { text: 'Create ', matched: false },
      { text: 'table', matched: true },
    ]);
  });

  it('marks nothing when only a keyword matched', () => {
    const [result] = rankCommands([command({ label: 'Remove row', keywords: ['delete'] })], 'delete');

    expect(result?.segments).toEqual([{ text: 'Remove row', matched: false }]);
  });

  it('keeps the whole label across the segments', () => {
    const label = 'Duplicate the selected row';
    const [result] = rankCommands([command({ label })], 'dsr');

    expect(result?.segments.map((segment) => segment.text).join('')).toBe(label);
  });

  it('breaks a tie by the shorter label', () => {
    const commands = [command({ label: 'Add a very long thing indeed' }), command({ label: 'Add' })];

    expect(labelsFor(commands, 'add')).toEqual(['Add', 'Add a very long thing indeed']);
  });

  it('breaks a remaining tie alphabetically, so the order is stable', () => {
    const commands = [command({ label: 'Add zone' }), command({ label: 'Add area' })];

    expect(labelsFor(commands, 'add')).toEqual(['Add area', 'Add zone']);
  });

  it('keeps a disabled command in the results', () => {
    const commands = [command({ label: 'Add user', disabled: true })];

    expect(labelsFor(commands, 'user')).toEqual(['Add user']);
  });
});

describe('groupResults', () => {
  it('lists ungrouped commands before any heading', () => {
    const commands = [command({ label: 'Grouped', group: 'Rows' }), command({ label: 'Loose' })];

    expect(groupResults(rankCommands(commands, ''))).toEqual([
      { label: null, results: [expect.objectContaining({ command: expect.objectContaining({ label: 'Loose' }) })] },
      { label: 'Rows', results: [expect.objectContaining({ command: expect.objectContaining({ label: 'Grouped' }) })] },
    ]);
  });

  it('orders groups by their best result', () => {
    const commands = [command({ label: 'Weak user thing', group: 'Late' }), command({ label: 'User', group: 'Early' })];

    expect(groupResults(rankCommands(commands, 'user')).map((group) => group.label)).toEqual(['Early', 'Late']);
  });

  it('keeps the ranked order inside a group', () => {
    const commands = [
      command({ label: 'Add a very long thing indeed', group: 'Rows' }),
      command({ label: 'Add', group: 'Rows' }),
    ];

    const [group] = groupResults(rankCommands(commands, 'add'));

    expect(group?.results.map((result) => result.command.label)).toEqual(['Add', 'Add a very long thing indeed']);
  });

  it('returns nothing for no results', () => {
    expect(groupResults([])).toEqual([]);
  });
});
