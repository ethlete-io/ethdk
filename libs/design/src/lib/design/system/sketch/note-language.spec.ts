import { describe, expect, it } from 'vitest';
import { noteLanguageOf, noteLanguageWarningsOf } from './note-language';
import { Sketch } from './sketch';

const sketchWith = (round: string, variant: string) =>
  ({
    target: 'components/zoom-chip',
    rounds: [{ key: 'r1', title: 'Round', note: round }],
    variants: ['a'],
    variantInfo: { a: { note: variant } },
  }) as unknown as Sketch;

describe('note language', () => {
  it('tells German from English and stays silent on short notes', () => {
    expect(noteLanguageOf('Der Zurücksetzen-Knopf ist ein schlichter Button')).toBe('de');
    expect(noteLanguageOf('reset is a plain SDK button with the icon')).toBe('en');
    expect(noteLanguageOf('Pill')).toBeNull();
  });

  it('warns on a note in another language than the product', () => {
    const sketch = sketchWith('the dot is on the button', 'Punkt mit Zahl auf dem Knopf, ist rund');

    expect(noteLanguageWarningsOf(sketch, 'de')).toEqual([
      "NOTE-LANGUAGE components/zoom-chip round r1: the note reads as en, the product's notes are de",
    ]);
    expect(noteLanguageWarningsOf(sketchWith('Der Punkt ist auf dem Knopf', 'Rund und klein'), 'de')).toEqual([]);
  });
});
