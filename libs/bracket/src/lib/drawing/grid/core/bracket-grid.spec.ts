import { createBracketElement } from './bracket-element';
import { createBracketGrid } from './bracket-grid';
import { createBracketMasterColumn } from './bracket-master-column';
import { createBracketMasterColumnSection } from './bracket-master-column-section';
import { createBracketSubColumn } from './bracket-sub-column';

const buildSection = (padding?: { top: number; bottom: number; left: number; right: number }) => {
  const { masterColumnSection, pushSubColumn } = createBracketMasterColumnSection({ type: 'round', padding });
  const { subColumn, pushElement } = createBracketSubColumn({ span: { isStart: true, isEnd: true } });
  const { element } = createBracketElement({
    type: 'matchGap',
    area: '.',
    partHeights: [20],
    elementHeight: 20,
  });

  pushElement(element);
  pushSubColumn(subColumn);

  return masterColumnSection;
};

describe('createBracketGrid', () => {
  it('accounts for a section top padding in both its own height and the next section top', () => {
    const { grid, pushMasterColumn, calculateDimensions } = createBracketGrid({ spanElementWidth: 0 });
    const { masterColumn, pushSection } = createBracketMasterColumn({
      columnWidth: 100,
      padding: { top: 0, bottom: 0, left: 0, right: 0 },
    });

    const paddedSection = buildSection({ top: 10, bottom: 5, left: 3, right: 3 });
    const plainSection = buildSection();

    pushSection(paddedSection, plainSection);
    pushMasterColumn(masterColumn);
    calculateDimensions();

    expect(paddedSection.dimensions.height).toBe(10 + 20 + 5);
    expect(paddedSection.dimensions.top + paddedSection.dimensions.height).toBe(plainSection.dimensions.top);
    expect(grid.dimensions.height).toBe(masterColumn.dimensions.height);
  });
});
