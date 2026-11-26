import { drawSwissMan, DrawSwissManDimensions } from './draw-man-swiss';

const matchElement = (roundId: string, groupId: string, left: number) => ({
  type: 'match',
  roundSwissGroup: { id: groupId },
  round: { id: roundId },
  dimensions: { top: 0, height: 50, left, width: 100 },
  match: { winner: null, home: null, away: null },
});

const bracketGrid = {
  columns: [
    { dimensions: { left: 0, width: 100 }, elements: [matchElement('r1', '0-0', 0)] },
    { dimensions: { left: 200, width: 100 }, elements: [matchElement('r2', '1-0', 200)] },
  ],
} as unknown as DrawSwissManDimensions['bracketGrid'];

describe('drawSwissMan', () => {
  it('escapes color values before writing them into svg attributes', () => {
    const injected = '"/><image href="x" onerror="alert(1)';

    const svg = drawSwissMan({
      bracketGrid,
      path: { width: 1, dashArray: 0, dashOffset: 0 },
      curve: { lineStartingCurveAmount: 0 },
      groupBorder: { padding: 0, radius: 0, width: 1 },
      colors: { neutral: injected, positive: `${injected}-positive` },
      idPrefix: 'test',
    });

    const container = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    container.innerHTML = svg;

    expect(container.querySelector('image')).toBeNull();
    expect(container.querySelector('rect')?.getAttribute('stroke')).toBe(injected);
    expect(container.querySelector('stop')?.getAttribute('stop-color')).toBe(injected);
  });
});
