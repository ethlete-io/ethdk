import { gatedByPartErrors, partErrorsOf } from './part-errors';

describe('partErrorsOf', () => {
  it('lists the load problems of a part and the load errors of its sketch targets', () => {
    expect(
      partErrorsOf({
        problems: [
          { rule: 'LOAD', message: 'Failed to load url ./a.ts' },
          { rule: 'NAMING', message: 'bad name' },
        ],
        targets: [{ variant: 'a' }, { variant: 'b', error: 'Failed to load url ./b.ts' }],
      }),
    ).toEqual(['Failed to load url ./a.ts', 'Failed to load url ./b.ts']);
  });

  it('is empty for a part that loads', () => {
    expect(partErrorsOf({ problems: [{ rule: 'NAMING', message: 'x' }], targets: [{ variant: 'a' }] })).toEqual([]);
  });
});

describe('gatedByPartErrors', () => {
  it('turns a ready status into blocked with one sdk-error blocker per error', () => {
    expect(gatedByPartErrors({ state: 'ready' }, ['boom'])).toEqual({
      state: 'blocked',
      blockers: [{ kind: 'sdk-error', text: 'boom' }],
    });
  });

  it('puts the errors before the blockers a blocked status already has, and keeps a developer note', () => {
    expect(
      gatedByPartErrors({ state: 'blocked', blockers: [{ kind: 'open-point', text: 'p' }], developer: ['d'] }, [
        'boom',
      ]),
    ).toEqual({
      state: 'blocked',
      blockers: [
        { kind: 'sdk-error', text: 'boom' },
        { kind: 'open-point', text: 'p' },
      ],
      developer: ['d'],
    });
  });

  it('blocks a checking status too', () => {
    expect(gatedByPartErrors({ state: 'checking' }, ['boom']).state).toBe('blocked');
  });

  it('leaves the status alone without errors', () => {
    expect(gatedByPartErrors({ state: 'ready' }, [])).toEqual({ state: 'ready' });
  });
});
