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

  it('gives the same geometry when the dimensions are calculated twice', () => {
    const { grid, pushMasterColumn, calculateDimensions } = createBracketGrid({ spanElementWidth: 0 });
    const { masterColumn, pushSection } = createBracketMasterColumn({
      columnWidth: 100,
      padding: { top: 0, bottom: 0, left: 5, right: 5 },
    });

    pushSection(buildSection());
    pushMasterColumn(masterColumn);
    calculateDimensions();
    calculateDimensions();

    expect(masterColumn.dimensions.width).toBe(110);
    expect(grid.dimensions.width).toBe(110);
  });

  it('places a spanning element over the sub-columns it spans, inside the section padding', () => {
    const { pushMasterColumn, calculateDimensions, setupElementSpans } = createBracketGrid({ spanElementWidth: 40 });
    const { masterColumn, pushSection } = createBracketMasterColumn({
      columnWidth: 120,
      padding: { top: 0, bottom: 0, left: 0, right: 0 },
    });
    const { masterColumnSection, pushSubColumn } = createBracketMasterColumnSection({
      type: 'round',
      padding: { top: 0, bottom: 0, left: 20, right: 0 },
    });
    const { element } = createBracketElement({ type: 'matchGap', area: '.', partHeights: [20], elementHeight: 20 });
    const first = createBracketSubColumn({ span: { isStart: true, isEnd: false } });
    const second = createBracketSubColumn({ span: { isStart: false, isEnd: true } });

    first.pushElement(element);
    second.pushElement(
      createBracketElement({ type: 'matchGap', area: '.', partHeights: [20], elementHeight: 20 }).element,
    );
    pushSubColumn(first.subColumn, second.subColumn);
    pushSection(masterColumnSection);
    pushMasterColumn(masterColumn);
    setupElementSpans();
    calculateDimensions();

    expect(first.subColumn.dimensions.left).toBe(20);
    expect(second.subColumn.dimensions.left + second.subColumn.dimensions.width).toBe(120);
    expect(element.dimensions.left).toBe(20 + (100 - 40) / 2);
    expect(element.dimensions.width).toBe(40);
  });
});
