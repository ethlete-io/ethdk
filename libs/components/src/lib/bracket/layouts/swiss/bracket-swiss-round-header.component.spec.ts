import { Component, Directive, input } from '@angular/core';
import { provideColorThemesWithTailwind4 } from '@ethlete/core';
import {
  BracketRound,
  BracketRoundSwissGroup,
  BracketSwissColors,
  MatchParticipantSide,
  SWISS_BRACKET_ROUND_TYPE,
  TOURNAMENT_MODE,
} from '@ethlete/bracket';
import '../../../../test-helpers';
import { TEST_SEMANTIC_COLOR_THEMES } from '../../../testing/color-themes';
import { BracketComponentOverrides, resolveBracketComponents } from '../../bracket-components';
import { BracketConfig } from '../../bracket.config';
import { BRACKET_DEFAULT_CARDS } from '../../bracket-default-cards';
import { BracketDataSource } from '../../integrations';
import { bracketTestDriver } from '../../testing/bracket-driver';
import { BracketSwissRoundHeaderComponent } from './bracket-swiss-round-header.component';
import { swissBracketLayout } from './swiss-bracket-layout';
import { swissRecordTone } from './swiss-tone-themes';

@Directive()
abstract class TestHeader {
  public bracketRound = input.required<BracketRound<unknown, unknown>>();
  public bracketRoundSwissGroup = input.required<BracketRoundSwissGroup<unknown, unknown> | null>();
}

@Component({ selector: 'et-test-global-header', template: '' })
class GlobalHeader extends TestHeader {}

@Component({ selector: 'et-test-swiss-config-header', template: '' })
class SwissConfigHeader extends TestHeader {}

@Component({ selector: 'et-test-layout-header', template: '' })
class LayoutHeader extends TestHeader {}

@Component({ selector: 'et-test-host-header', template: '' })
class HostHeader extends TestHeader {}

type SwissMatchInput = [id: string, home: string, away: string, winner: MatchParticipantSide | null];

const swissSource = (rounds: SwissMatchInput[][]): BracketDataSource<null, null> => ({
  mode: TOURNAMENT_MODE.SWISS_WITH_ELIMINATION,
  rounds: rounds.map((_, index) => ({
    id: `r${index}`,
    type: SWISS_BRACKET_ROUND_TYPE.SWISS,
    name: `Round ${index + 1}`,
    data: null,
  })),
  matches: rounds.flatMap((matches, index) =>
    matches.map(([id, home, away, winner]) => ({
      id,
      roundId: `r${index}`,
      home,
      away,
      winner,
      status: winner ? ('completed' as const) : ('pending' as const),
      data: null,
    })),
  ),
});

const roundHeaderFor = (options: {
  host?: boolean;
  layoutOption?: boolean;
  swissConfig?: boolean;
  globalConfig?: boolean;
}) => {
  const config: BracketConfig = {
    ...BRACKET_DEFAULT_CARDS,
    roundHeaderComponent: options.globalConfig ? GlobalHeader : undefined,
    swiss: options.swissConfig ? { roundHeaderComponent: SwissConfigHeader } : undefined,
  };
  const overrides: BracketComponentOverrides<unknown, unknown> = options.host ? { roundHeader: HostHeader } : {};

  return resolveBracketComponents({
    overrides,
    config,
    layout: swissBracketLayout(options.layoutOption ? { roundHeaderComponent: LayoutHeader } : {}),
    showsContinueElement: false,
  }).roundHeader;
};

describe('swissRecordTone', () => {
  it.each([
    ['0-0', 'neutral'],
    ['1-0', 'positive'],
    ['1-1', 'warning'],
    ['0-2', 'negative'],
  ])('gives the %s record the %s tone', (record, tone) => {
    expect(swissRecordTone(record)).toBe(tone);
  });

  it('gives an id that is no record the neutral tone', () => {
    expect(swissRecordTone('group-a')).toBe('neutral');
  });
});

describe('the swiss round header precedence', () => {
  const all = { host: true, layoutOption: true, swissConfig: true, globalConfig: true };

  it('takes the host input over everything', () => {
    expect(roundHeaderFor(all)).toBe(HostHeader);
  });

  it('takes the layout option over both config slots', () => {
    expect(roundHeaderFor({ ...all, host: false })).toBe(LayoutHeader);
  });

  it('takes the swiss config slot over the swiss default', () => {
    expect(roundHeaderFor({ swissConfig: true, globalConfig: true })).toBe(SwissConfigHeader);
  });

  it('takes the swiss default over the global config header', () => {
    expect(roundHeaderFor({ globalConfig: true })).toBe(BracketSwissRoundHeaderComponent);
  });
});

describe('the swiss default round header', () => {
  const render = (colors?: BracketSwissColors) => {
    const driver = bracketTestDriver({
      source: swissSource([
        [
          ['r0-m0', 'a', 'b', 'home'],
          ['r0-m1', 'c', 'd', 'home'],
          ['r0-m2', 'e', 'f', 'home'],
          ['r0-m3', 'g', 'h', 'home'],
        ],
        [
          ['r1-m0', 'a', 'c', 'home'],
          ['r1-m1', 'e', 'g', 'home'],
          ['r1-m2', 'b', 'd', 'home'],
          ['r1-m3', 'f', 'h', 'home'],
        ],
        [
          ['r2-m0', 'a', 'e', null],
          ['r2-m1', 'c', 'b', null],
          ['r2-m2', 'g', 'f', null],
          ['r2-m3', 'd', 'h', null],
        ],
      ]),
      layouts: [swissBracketLayout({ colors })],
      providers: [provideColorThemesWithTailwind4(TEST_SEMANTIC_COLOR_THEMES)],
    });

    return {
      groupBorders: Array.from(driver.element().querySelectorAll('.et-bracket-svg g'), (group) =>
        Array.from(group.classList).find((name) => name.startsWith('et-color--')),
      ),
      headers: Array.from(
        driver.element().querySelectorAll<HTMLElement>('.et-bracket-swiss-round-header'),
        (header) => ({
          text: ['name', 'rule', 'record']
            .map((part) => header.querySelector(`.et-bracket-swiss-round-header-${part}`)?.textContent?.trim() ?? '?')
            .join('|'),
          tone: header.dataset['swissTone'],
          theme: Array.from(header.classList).find((name) => name.startsWith('et-color--')),
        }),
      ),
    };
  };

  it('draws the round name, a rule and the record in the record tone', () => {
    expect(render().headers).toEqual([
      { text: 'Round 1||0-0', tone: 'neutral', theme: 'et-color--inherited' },
      { text: 'Round 2||1-0', tone: 'positive', theme: 'et-color--grass' },
      { text: 'Round 2||0-1', tone: 'warning', theme: 'et-color--sunshine' },
      { text: 'Round 3||2-0', tone: 'positive', theme: 'et-color--grass' },
      { text: 'Round 3||1-1', tone: 'warning', theme: 'et-color--sunshine' },
      { text: 'Round 3||0-2', tone: 'negative', theme: 'et-color--danger' },
    ]);
  });

  it('outlines each group box in the theme of its record tone', () => {
    expect(render().groupBorders).toEqual([
      'et-color--inherited',
      'et-color--grass',
      'et-color--sunshine',
      'et-color--grass',
      'et-color--sunshine',
      'et-color--danger',
    ]);
  });

  it('draws the group boxes as svg elements', () => {
    const driver = bracketTestDriver({
      source: swissSource([[['r0-m0', 'a', 'b', 'home']], [['r1-m0', 'a', 'b', 'home']]]),
      layouts: [swissBracketLayout()],
      providers: [provideColorThemesWithTailwind4(TEST_SEMANTIC_COLOR_THEMES)],
    });
    const boxes = Array.from(driver.element().querySelectorAll('.et-bracket-svg rect'));

    expect(boxes.length).toBeGreaterThan(0);
    const namespaces = boxes.flatMap((box) => [
      box.namespaceURI,
      box.parentElement?.namespaceURI,
      box.closest('[et-bracket-swiss-group-borders]')?.namespaceURI,
    ]);

    expect(new Set(namespaces)).toEqual(new Set(['http://www.w3.org/2000/svg']));
  });

  it('colours each header like the box of its group when the layout sets colors', () => {
    const colors: BracketSwissColors = {
      neutral: '#111111',
      positive: '#222222',
      warning: '#333333',
      negative: '#444444',
    };
    const driver = bracketTestDriver({
      source: swissSource([
        [
          ['r0-m0', 'a', 'b', 'home'],
          ['r0-m1', 'c', 'd', 'home'],
        ],
        [
          ['r1-m0', 'a', 'c', 'home'],
          ['r1-m1', 'b', 'd', 'home'],
        ],
      ]),
      layouts: [swissBracketLayout({ colors })],
      providers: [provideColorThemesWithTailwind4(TEST_SEMANTIC_COLOR_THEMES)],
    });
    const root = driver.element();
    const section = root.querySelector<HTMLElement>('[style*="--et-bracket-swiss"]');
    const boxStrokes = Array.from(root.querySelectorAll('.et-bracket-svg rect[stroke]'), (rect) =>
      rect.getAttribute('stroke'),
    );
    const headerTones = Array.from(
      root.querySelectorAll<HTMLElement>('.et-bracket-swiss-round-header'),
      (header) => header.dataset['swissTone'] as keyof BracketSwissColors,
    );

    expect(headerTones).toEqual(['neutral', 'positive', 'warning']);
    expect(headerTones.map((tone) => section?.style.getPropertyValue(`--et-bracket-swiss-${tone}-color`))).toEqual(
      boxStrokes,
    );
  });
});
