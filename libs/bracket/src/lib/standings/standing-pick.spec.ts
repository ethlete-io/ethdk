import { standingPickOutcome } from './standing-pick';

const outcome = (predictedPosition: number, actualPosition: number, advancingCount = 2) =>
  standingPickOutcome({ predictedPosition, actualPosition, advancingCount });

describe('standingPickOutcome', () => {
  it('scores a matching position exactly, above and below the advancing line', () => {
    expect(outcome(1, 1)).toBe('exact');
    expect(outcome(2, 2)).toBe('exact');
    expect(outcome(3, 3)).toBe('exact');
    expect(outcome(4, 4)).toBe('exact');
  });

  it('scores the right side of the line on the wrong position as partial', () => {
    expect(outcome(1, 2)).toBe('partial');
    expect(outcome(2, 1)).toBe('partial');
    expect(outcome(3, 4)).toBe('partial');
    expect(outcome(4, 3)).toBe('partial');
  });

  it('scores either way across the line as wrong', () => {
    expect(outcome(2, 3)).toBe('wrong');
    expect(outcome(3, 2)).toBe('wrong');
    expect(outcome(1, 8)).toBe('wrong');
    expect(outcome(8, 1)).toBe('wrong');
  });

  it('takes the whole field as non-advancing when nothing advances', () => {
    expect(outcome(1, 1, 0)).toBe('exact');
    expect(outcome(1, 2, 0)).toBe('partial');
  });

  it('takes the whole field as advancing when every position does', () => {
    expect(outcome(4, 4, 4)).toBe('exact');
    expect(outcome(1, 4, 4)).toBe('partial');
  });
});
