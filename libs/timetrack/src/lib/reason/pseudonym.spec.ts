import { describe, expect, it } from 'vitest';
import { EMPTY_PSEUDONYM_MAP, maskIssueKey, maskNames, pseudonymMap, unmaskNames, unmaskedWords } from './pseudonym';

const NAMES = ['Fifagg', 'Braune Digital', 'Ethlete'];
const MAP = pseudonymMap(NAMES);

const pseudonymFor = (name: string) => MAP.byName.get(name.toLowerCase()) ?? '';

describe('pseudonymMap', () => {
  it('gives every name a pseudonym of its own', () => {
    const words = NAMES.map(pseudonymFor);

    expect(words.every(Boolean)).toBe(true);
    expect(new Set(words).size).toBe(NAMES.length);
  });

  it('assigns the same words whatever order the names were typed in', () => {
    const reversed = pseudonymMap([...NAMES].reverse());

    expect([...reversed.byName]).toEqual([...MAP.byName]);
  });

  it('reads one name once, whatever case it was written in', () => {
    const twice = pseudonymMap(['Fifagg', 'FIFAGG', '  ', 'fifagg']);

    expect(twice.byName.size).toBe(1);
    expect(twice.names.get('fifagg')).toBe('Fifagg');
  });

  it('keeps every pseudonym distinct on a list longer than the words it draws from', () => {
    const many = Array.from({ length: 200 }, (_, index) => `client-${index}`);
    const map = pseudonymMap(many);

    expect(map.byName.size).toBe(many.length);
    expect(map.byPseudonym.size).toBe(many.length);
  });

  it('reads a pseudonym back to the name as the user wrote it', () => {
    const word = pseudonymFor('Braune Digital');

    expect(MAP.byPseudonym.get(word.toLowerCase())).toBe('Braune Digital');
  });
});

describe('maskNames', () => {
  it('replaces a name and leaves the rest of the sentence as written', () => {
    const text = maskNames({ text: 'the Fifagg competition journey', map: MAP });

    expect(text).toBe(`the ${pseudonymFor('Fifagg')} competition journey`);
  });

  it('answers a match written in capitals in capitals, which masks an issue key in free text', () => {
    const text = maskNames({ text: 'fix FIFAGG-12623 and ship it', map: MAP });

    expect(text).toBe(`fix ${pseudonymFor('Fifagg').toUpperCase()}-12623 and ship it`);
  });

  it('leaves a longer word that merely starts with a name alone', () => {
    expect(maskNames({ text: 'Fifaggregator', map: MAP })).toBe('Fifaggregator');
  });

  it('masks a name written as several words', () => {
    expect(maskNames({ text: 'for Braune Digital', map: MAP })).toBe(`for ${pseudonymFor('Braune Digital')}`);
  });

  it('changes nothing when no name is listed', () => {
    expect(maskNames({ text: 'the Fifagg journey', map: EMPTY_PSEUDONYM_MAP })).toBe('the Fifagg journey');
  });

  it('reads its own output back to the names it was given', () => {
    const text = 'FIFAGG-12623 for Braune Digital, reviewed by Ethlete';

    expect(unmaskNames({ text: maskNames({ text, map: MAP }), map: MAP })).toBe(text);
  });
});

describe('maskIssueKey', () => {
  it('masks the project prefix and keeps the number', () => {
    expect(maskIssueKey({ issueKey: 'FIFAGG-12623', map: MAP })).toBe(`${pseudonymFor('Fifagg').toUpperCase()}-12623`);
  });

  it('returns a key whose project no name list holds as it was written', () => {
    expect(maskIssueKey({ issueKey: 'ABC-1', map: MAP })).toBe('ABC-1');
  });
});

describe('unmaskedWords', () => {
  it('reports a capitalised word the app cannot account for', () => {
    expect(unmaskedWords({ text: 'a report for Nordkiosk', map: MAP })).toEqual(['Nordkiosk']);
  });

  it('accounts for a listed name, its pseudonym, and a word the industry shares', () => {
    const text = `Fifagg ${pseudonymFor('Fifagg')} Angular Gitlab`;

    expect(unmaskedWords({ text, map: MAP })).toEqual([]);
  });

  it('reports each unknown word once, in reading order of the alphabet', () => {
    expect(unmaskedWords({ text: 'Zephyr and Nordkiosk and Zephyr', map: MAP })).toEqual(['Nordkiosk', 'Zephyr']);
  });

  it('says nothing about a single capital letter, which is an initial rather than a name', () => {
    expect(unmaskedWords({ text: 'signed off by T', map: MAP })).toEqual([]);
  });
});

describe('a name that is also a pseudonym word', () => {
  it('never takes itself as its own pseudonym', () => {
    const map = pseudonymMap(['Mesa']);

    expect(map.byName.get('mesa')).not.toBe('Mesa');
    expect(maskNames({ text: 'We shipped it for Mesa', map })).not.toContain('Mesa');
  });

  it('still reads its answer back into the real name', () => {
    const map = pseudonymMap(['Mesa', 'Fifagg']);
    const masked = maskNames({ text: 'Mesa asked Fifagg for it', map });

    expect(masked).not.toContain('Mesa');
    expect(masked).not.toContain('Fifagg');
    expect(unmaskNames({ text: masked, map })).toBe('Mesa asked Fifagg for it');
  });
});
