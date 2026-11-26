import { describe, expect, it } from 'vitest';
import {
  CLASSED_ACTIONS,
  actionClassChoices,
  actionClassOf,
  autoModeActs,
  parseActionClasses,
  withActionClass,
} from './action-classes';

describe('actionClassOf', () => {
  it('reads the table where nothing is set', () => {
    expect(actionClassOf('autoMode.apply', {})).toBe('local');
    expect(actionClassOf('autoMode.create', {})).toBe('external');
    expect(actionClassOf('jira.create', {})).toBe('external');
  });

  it('takes a stricter class and never a looser one', () => {
    expect(actionClassOf('autoMode.apply', { 'autoMode.apply': 'external' })).toBe('external');
    expect(actionClassOf('tempo.sync', { 'tempo.sync': 'local' })).toBe('human-only');
    expect(actionClassOf('autoMode.create', { 'autoMode.create': 'read' })).toBe('external');
  });
});

describe('actionClassChoices', () => {
  it('offers auto mode every class from its table class up', () => {
    expect(actionClassChoices('autoMode.apply')).toEqual(['local', 'external', 'human-only']);
    expect(actionClassChoices('autoMode.create')).toEqual(['external', 'human-only']);
  });

  it('offers a CLI write only human-only on top, and a read or a human-only op nothing', () => {
    expect(actionClassChoices('day.edits')).toEqual(['local', 'human-only']);
    expect(actionClassChoices('jira.create')).toEqual(['external', 'human-only']);
    expect(actionClassChoices('day.rows')).toEqual([]);
    expect(actionClassChoices('tempo.sync')).toEqual([]);
    expect(CLASSED_ACTIONS).not.toContain('day.rows');
    expect(CLASSED_ACTIONS.slice(0, 2)).toEqual(['autoMode.apply', 'autoMode.create']);
  });
});

describe('withActionClass', () => {
  it('stores a stricter class and clears the table class', () => {
    const stricter = withActionClass({}, { action: 'autoMode.apply', opClass: 'external' });

    expect(stricter).toEqual({ 'autoMode.apply': 'external' });
    expect(withActionClass(stricter, { action: 'autoMode.apply', opClass: 'local' })).toEqual({});
  });

  it('refuses a class the action does not offer', () => {
    expect(withActionClass({}, { action: 'autoMode.create', opClass: 'local' })).toEqual({});
    expect(withActionClass({}, { action: 'day.rows', opClass: 'human-only' })).toEqual({});
  });
});

describe('parseActionClasses', () => {
  it('keeps only known actions at a stricter class they offer', () => {
    expect(
      parseActionClasses({
        'autoMode.apply': 'human-only',
        'autoMode.create': 'local',
        'jira.create': 'external',
        'day.rows': 'human-only',
        'made.up': 'human-only',
        'day.edits': 'nonsense',
      }),
    ).toEqual({ 'autoMode.apply': 'human-only' });
    expect(parseActionClasses(undefined)).toEqual({});
  });
});

describe('autoModeActs', () => {
  it('is off only once both auto mode actions are human-only', () => {
    expect(autoModeActs({ 'autoMode.apply': 'human-only' })).toBe(true);
    expect(autoModeActs({ 'autoMode.apply': 'human-only', 'autoMode.create': 'human-only' })).toBe(false);
  });
});
