import '../../test-helpers';
import { Component, input, ViewEncapsulation } from '@angular/core';
import { BracketGridSection } from '@ethlete/bracket';
import { queryAll } from '../testing/driver-core';
import { BRACKET_DEFAULT_CARDS } from './bracket-default-cards';
import { BracketConfig, provideBracketConfig } from './bracket.config';
import { bracketTestDriver, testBracketLayouts } from './testing/bracket-driver';
import { generateDoubleEliminationBracket } from './stories/generate-bracket';

@Component({
  selector: 'et-test-section-title',
  template: `custom {{ bracketSection().key }}`,
  encapsulation: ViewEncapsulation.None,
})
class TestSectionTitleComponent {
  public bracketSection = input.required<BracketGridSection>();
}

const mount = (config: BracketConfig) => {
  const driver = bracketTestDriver({
    source: generateDoubleEliminationBracket({ participantCount: 8, includeFinal: true }),
    layouts: testBracketLayouts,
    providers: [provideBracketConfig({ ...BRACKET_DEFAULT_CARDS, ...config })],
  });

  const titles = () => queryAll(driver.fixture, '.et-bracket-section-title');

  return { driver, titles };
};

describe('BracketComponent section titles', () => {
  it('draws none by default, so the grid keeps its height', () => {
    const { titles } = mount({});

    expect(titles()).toEqual([]);
  });

  it('heads the upper bracket, the lower bracket and the finals with the localized labels', () => {
    const { titles } = mount({ showSectionTitles: true });

    expect(titles().map((title) => [title.getAttribute('data-section'), title.textContent?.trim()])).toEqual([
      ['upper', 'Upper bracket'],
      ['lower', 'Lower bracket'],
      ['finals', 'Finals'],
    ]);
    expect(titles()[0]?.querySelector('[role="heading"]')?.getAttribute('aria-level')).toBe('2');
  });

  it('pushes the rounds down by the title band', () => {
    const { driver } = mount({});
    const before = driver.positionOf('ub-r0-m0').y;
    const after = mount({ showSectionTitles: true, sectionTitleHeight: 30 }).driver.positionOf('ub-r0-m0').y;

    expect(after - before).toBe(30);
  });

  it('draws a custom title component where one is registered', () => {
    const { titles } = mount({ showSectionTitles: true, sectionTitleComponent: TestSectionTitleComponent });

    expect(titles().map((title) => title.textContent?.trim())).toEqual([
      'custom upper',
      'custom lower',
      'custom finals',
    ]);
  });
});
