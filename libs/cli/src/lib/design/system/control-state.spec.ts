import { describe, expect, it } from 'vitest';
import { controlStateGapsOf, introducedControlStateGapsOf, isInteractionState } from './complete';

describe('control state matching', () => {
  it('counts an interaction word only as the last word or the whole name', () => {
    expect(
      ['focus', 'row-hover', 'collapseFocused', 'focus-visible', 'active-only', 'hover-card', 'rest'].filter(
        isInteractionState,
      ),
    ).toEqual(['focus', 'row-hover', 'collapseFocused', 'focus-visible']);
  });

  it('drops modifier words from the element name', () => {
    const states = ['invalid-focus', 'row-open-hover', 'disabled-hover'];
    const elements = controlStateGapsOf({ part: 'elements/shell', controls: undefined, states }).map(
      (gap) => /extract the (\S+) as/u.exec(gap.detail)?.[1],
    );

    expect(elements).toEqual(['control', 'row']);
  });

  it('asks a component without controls to declare them, and others to extract', () => {
    const states = ['row-hover'];
    const detailOf = (part: string, controls: unknown) => controlStateGapsOf({ part, controls, states })[0]?.detail;

    expect(detailOf('components/list', undefined)).toContain(
      'declare its controls (Q164), or extract the row as its own control part',
    );
    expect(detailOf('components/list', {})).toContain('declare its controls (Q164)');
    expect(detailOf('elements/shell', undefined)).toContain('- extract the row as its own control part');
    expect(detailOf('components/odd', { odd: { kind: 'slider' } })).not.toContain('Q164');
    expect(detailOf('pages/home', undefined)).toContain('a page is no control part - extract the row');
  });

  describe('in render check', () => {
    const part = 'pages/system';
    const base = { controls: undefined, states: ['default', 'part-focus-visible', 'points-closed-focus-visible'] };
    const elementsOf = (gaps: { detail: string }[]) => gaps.map((gap) => /extract the (\S+) as/u.exec(gap.detail)?.[1]);

    it('does not fail a sketch on a gap its base part already has', () => {
      expect(
        introducedControlStateGapsOf({ part, controls: undefined, states: base.states, sketch: true, base }),
      ).toEqual([]);
    });

    it('fails a sketch on a gap the variant introduces', () => {
      const states = [...base.states, 'comment-hover'];

      expect(
        elementsOf(introducedControlStateGapsOf({ part, controls: undefined, states, sketch: true, base })),
      ).toEqual(['comment']);
    });

    it('counts every gap of a part the sketch adds', () => {
      expect(
        elementsOf(
          introducedControlStateGapsOf({ part, controls: undefined, states: base.states, sketch: true, base: null }),
        ),
      ).toEqual(['part', 'points-closed']);
    });

    it('agrees with product check on the gaps of the base', () => {
      const states = base.states;

      expect(introducedControlStateGapsOf({ part, controls: undefined, states, sketch: true, base })).toEqual(
        introducedControlStateGapsOf({ part, controls: undefined, states, sketch: false, base: null }),
      );
    });
  });
});
