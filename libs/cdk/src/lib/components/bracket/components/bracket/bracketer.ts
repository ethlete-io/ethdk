import { Signal, computed, effect, signal } from '@angular/core';
import { MatchListView, RoundStageStructureWithMatchesView } from '@ethlete/types';

interface BaseConfig {
  rounds: RoundStageStructureWithMatchesView[];
}

interface BaseConfigWithMeta {
  rounds: RoundStageStructureWithMatchesView[];
  bracketType: 'single' | 'double' | 'swiss';
  itemSize: [inline: number, block: number];
  gap: [inline: number, block: number];
}

interface BaseConfigWithMetaSignals {
  rounds: RoundStageStructureWithMatchesView[];
  bracketType: Signal<BracketType | null>;
  itemSize: Signal<Vec2>;
  gap: Signal<Vec2>;
}

const determineBracketType = (config: BaseConfig) => {
  const { rounds } = config;
  if (rounds.some((r) => r.round.type === 'loser_bracket')) {
    return 'double';
  } else {
    const firstRound = rounds[0];
    const secondRound = rounds[1];

    if (!firstRound || !secondRound) {
      throw new Error('Bracket type could not be determined');
    }

    if (firstRound.matches.length / 2 === secondRound.matches.length) {
      return 'single';
    } else if (firstRound.matches.length === secondRound.matches.length) {
      return 'swiss';
    } else {
      throw new Error('Bracket type could not be determined');
    }
  }
};

const findIndexes = <T extends unknown[]>(data: T, predicate: (item: T[number]) => boolean) => {
  const indexes: number[] = [];

  for (let i = 0; i < data.length; i++) {
    if (predicate(data[i])) {
      indexes.push(i);
    }
  }

  return indexes;
};

const findIndex = <T extends unknown[]>(data: T, predicate: (item: T[number]) => boolean) => {
  for (let i = 0; i < data.length; i++) {
    if (predicate(data[i])) {
      return i;
    }
  }

  return null;
};

const sortRounds = (config: BaseConfigWithMeta) => {
  const { rounds, bracketType } = config;

  if (bracketType === 'single' || bracketType === 'swiss') {
    return rounds;
  }

  const winnerRoundIndexes = findIndexes(rounds, (round) => round.round.type === 'winner_bracket');
  const loserRoundIndexes = findIndexes(rounds, (round) => round.round.type === 'loser_bracket');
  const finalRoundIndex = findIndex(rounds, (round) => round.round.type === 'final');
  const reverseFinalRoundIndex = findIndex(rounds, (round) => round.round.type === 'reverse_final');
  const thirdPlaceRoundIndex = findIndex(rounds, (round) => round.round.type === 'third_place');

  const roundsSorted: RoundStageStructureWithMatchesView[] = [];

  for (const index of winnerRoundIndexes) {
    roundsSorted.push(rounds[index]!);
  }

  if (finalRoundIndex !== null) {
    roundsSorted.push(rounds[finalRoundIndex]!);
  }

  if (reverseFinalRoundIndex !== null) {
    roundsSorted.push(rounds[reverseFinalRoundIndex]!);
  }

  if (thirdPlaceRoundIndex !== null) {
    roundsSorted.push(rounds[thirdPlaceRoundIndex]!);
  }

  for (const index of loserRoundIndexes) {
    roundsSorted.push(rounds[index]!);
  }

  return roundsSorted;
};

const generateBracketCacheKey = (config: BaseConfigWithMeta) => {
  const { rounds, bracketType } = config;

  return `${rounds.length}-${bracketType}`;
};

type Vec2 = [inline: number, block: number];
interface ReactiveMatch {
  self: Signal<MatchListView>;
  parents: Signal<MatchListView[]>;
  child: Signal<MatchListView | null>;
  position: Signal<Vec2>;
}
interface ReactiveRound {
  self: Signal<RoundStageStructureWithMatchesView>;
  parent: Signal<ReactiveRoundWithMatches | null>;
  child: Signal<ReactiveRoundWithMatches | null>;
}
interface ReactiveRoundWithMatches {
  round: ReactiveRound;
  matches: ReactiveMatch[];
}

const createMatchPosition = (config: {
  bracketType: BracketType | null;
  itemSize: Vec2;
  gap: Vec2;
  roundIndex: number;
  matchIndex: number;
  rounds: RoundStageStructureWithMatchesView[];
}) => {
  const { bracketType, itemSize, gap, roundIndex, matchIndex, rounds } = config;
  const [itemInlineSize, itemBlockSize] = itemSize;
  const [gapInline, gapBlock] = gap;

  switch (bracketType) {
    case 'single': {
      const inline = roundIndex * (itemInlineSize + gapInline);

      let block = 0;

      if (roundIndex === 0) {
        block = matchIndex * (itemBlockSize + gapBlock);
      } else {
        const round = rounds[roundIndex]!;
        const totalHeight = (itemBlockSize + gapBlock) * rounds[0]!.matches.length - gapBlock;
        const matchCount = round.matches.length;
        const sectionHeight = totalHeight / matchCount;

        block = sectionHeight * matchIndex + sectionHeight / 2 - itemBlockSize / 2;
      }

      return [inline, block] as Vec2;
    }
    case 'double': {
      // TODO: implement
      return [0, 0] as Vec2;
    }
    case 'swiss': {
      // TODO: implement
      return [0, 0] as Vec2;
    }
  }

  return [0, 0] as Vec2;
};

const createReactiveRoundsWithMatches = (config: BaseConfigWithMetaSignals) => {
  const reactiveRounds: ReactiveRoundWithMatches[] = [];

  // Ggf. einfach den <ul> absolut stylen und die matches per flex und space-between?
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const roundInlineSize = computed(() => config.itemSize()[0]);

  for (const [roundIndex, round] of config.rounds.entries()) {
    const reactiveMatches: ReactiveMatch[] = [];

    for (const [matchIndex, match] of round.matches.entries()) {
      reactiveMatches.push({
        self: signal<MatchListView>(match),
        parents: signal<MatchListView[]>([]),
        child: signal<MatchListView | null>(null),
        position: computed(() =>
          createMatchPosition({
            bracketType: config.bracketType(),
            itemSize: config.itemSize(),
            gap: config.gap(),
            roundIndex,
            matchIndex,
            rounds: config.rounds,
          }),
        ),
      });
    }

    const reactiveRound: ReactiveRoundWithMatches = {
      round: {
        self: signal<RoundStageStructureWithMatchesView>(round),
        parent: signal<ReactiveRoundWithMatches | null>(null),
        child: signal<ReactiveRoundWithMatches | null>(null),
      },
      matches: reactiveMatches,
    };

    reactiveRounds.push(reactiveRound);
  }

  return reactiveRounds;
};

type BracketType = 'single' | 'double' | 'swiss';

export const createBracket = () => {
  const originalRounds = signal<RoundStageStructureWithMatchesView[]>([]);

  const currentBracket = {
    cacheKey: signal<string | null>(null),
    type: signal<BracketType | null>(null),
    rounds: signal<RoundStageStructureWithMatchesView[]>([]),
    reactiveRounds: signal<ReactiveRoundWithMatches[]>([]),
    itemSize: signal<Vec2>([300, 100]),
    gap: signal<Vec2>([30, 10]),
  };

  const updateItemSize = (itemSize: Vec2) => {
    currentBracket.itemSize.set(itemSize);
  };

  const updateGap = (gap: Vec2) => {
    currentBracket.gap.set(gap);
  };

  const updateRounds = (rounds: RoundStageStructureWithMatchesView[]) => {
    originalRounds.set(rounds);

    const bracketType = determineBracketType({ rounds });
    const sortedRounds = sortRounds({
      rounds,
      bracketType,
      itemSize: currentBracket.itemSize(),
      gap: currentBracket.gap(),
    });
    const cacheKey = generateBracketCacheKey({
      rounds: sortedRounds,
      bracketType,
      itemSize: currentBracket.itemSize(),
      gap: currentBracket.gap(),
    });

    if (currentBracket.cacheKey() === cacheKey) {
      // only update match and round signals
    } else {
      const reactiveRoundsWithMatches = createReactiveRoundsWithMatches({
        rounds: sortedRounds,
        bracketType: currentBracket.type,
        itemSize: currentBracket.itemSize,
        gap: currentBracket.gap,
      });

      currentBracket.reactiveRounds.set(reactiveRoundsWithMatches);
    }

    currentBracket.cacheKey.set(cacheKey);
    currentBracket.type.set(bracketType);
    currentBracket.rounds.set(sortedRounds);
  };

  effect(() => {
    const rounds = currentBracket.rounds();
    const bracketType = currentBracket.type();
    const cacheKey = currentBracket.cacheKey();

    console.log({
      rounds,
      bracketType,
      cacheKey,
      rrounds: currentBracket.reactiveRounds(),
    });
  });

  return {
    updateRounds,
    updateItemSize,
    updateGap,
    data: currentBracket.reactiveRounds,
  };
};
