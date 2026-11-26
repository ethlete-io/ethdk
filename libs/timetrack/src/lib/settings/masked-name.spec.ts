import { describe, expect, it } from 'vitest';
import { withMaskedName, withoutMaskedName } from './masked-name';
import { DEFAULT_TIMETRACK_SETTINGS, TimetrackSettings } from './model';

const settingsWith = (maskedNames: string[]): TimetrackSettings => ({
  ...DEFAULT_TIMETRACK_SETTINGS,
  reasoning: { ...DEFAULT_TIMETRACK_SETTINGS.reasoning, maskedNames },
});

describe('withMaskedName', () => {
  it('adds a name and keeps the spelling the user typed', () => {
    const settings = withMaskedName({ settings: settingsWith([]), name: '  FifaGG  ' });

    expect(settings.reasoning.maskedNames).toEqual(['FifaGG']);
  });

  it('keeps the order names were added in', () => {
    const first = withMaskedName({ settings: settingsWith([]), name: 'Alpha' });
    const second = withMaskedName({ settings: first, name: 'Beta' });

    expect(second.reasoning.maskedNames).toEqual(['Alpha', 'Beta']);
  });

  it('adds nothing for a name already held in another case', () => {
    const settings = withMaskedName({ settings: settingsWith(['FifaGG']), name: 'fifagg' });

    expect(settings.reasoning.maskedNames).toEqual(['FifaGG']);
  });

  it('adds nothing for an empty name', () => {
    const settings = withMaskedName({ settings: settingsWith(['Alpha']), name: '   ' });

    expect(settings.reasoning.maskedNames).toEqual(['Alpha']);
  });

  it('leaves the rest of the reasoning settings as written', () => {
    const settings = withMaskedName({ settings: settingsWith([]), name: 'Alpha' });

    expect(settings.reasoning.enabled).toBe(DEFAULT_TIMETRACK_SETTINGS.reasoning.enabled);
    expect(settings.reasoning.command).toBe(DEFAULT_TIMETRACK_SETTINGS.reasoning.command);
  });
});

describe('withoutMaskedName', () => {
  it('removes the name whatever case it is given in', () => {
    const settings = withoutMaskedName({ settings: settingsWith(['Alpha', 'FifaGG']), name: 'FIFAGG' });

    expect(settings.reasoning.maskedNames).toEqual(['Alpha']);
  });

  it('changes nothing for a name the list does not hold', () => {
    const settings = withoutMaskedName({ settings: settingsWith(['Alpha']), name: 'Beta' });

    expect(settings.reasoning.maskedNames).toEqual(['Alpha']);
  });
});
