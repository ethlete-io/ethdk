import { scorePasswordStrength } from './password-strength';

describe('scorePasswordStrength', () => {
  it('scores an empty password 0', () => {
    expect(scorePasswordStrength('')).toBe(0);
  });

  it('scores short single-class passwords 0', () => {
    expect(scorePasswordStrength('abc')).toBe(0);
    expect(scorePasswordStrength('1234567')).toBe(0);
  });

  it('rewards length', () => {
    expect(scorePasswordStrength('abcdefgh')).toBe(1);
    expect(scorePasswordStrength('abcdefghijkl')).toBe(2);
  });

  it('rewards character-class diversity', () => {
    expect(scorePasswordStrength('Abcdefg1')).toBe(2);
    expect(scorePasswordStrength('Abcdefgh1x')).toBe(3);
    expect(scorePasswordStrength('Abcdefgh1!xy')).toBe(4);
  });

  it('never exceeds 4', () => {
    expect(scorePasswordStrength('Extremely-Long-Passphrase-With-Everything-123!')).toBe(4);
  });
});
