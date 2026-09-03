import { BracketMatch, BracketRound } from '../../../linked';

export type BracketComponentType<TInputs> = new (...args: never[]) => TInputs;
export type BracketComponentInput<TValue> = () => TValue;

export type Dimensions = {
  width: number;
  height: number;
  top: number;
  left: number;
};

export type Spacing = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};

export type BracketRoundHeaderComponent<TRoundData, TMatchData> = BracketComponentType<{
  bracketRound: BracketComponentInput<BracketRound<TRoundData, TMatchData>>;
}>;

export type ComponentInputValue<T> = () => {
  [P in keyof T]: T[P] extends BracketComponentInput<infer TValue> ? TValue : never;
};

export type BracketMatchComponent<TRoundData, TMatchData> = BracketComponentType<{
  bracketRound: BracketComponentInput<BracketRound<TRoundData, TMatchData>>;
  bracketMatch: BracketComponentInput<BracketMatch<TRoundData, TMatchData>>;
}>;

export type BracketContinueComponent<TRoundData, TMatchData> = BracketComponentType<{
  /** The matches whose winners advance to the next competition stage */
  bracketMatches: BracketComponentInput<BracketMatch<TRoundData, TMatchData>[]>;
}>;

export type BracketComponents<TRoundData, TMatchData> = {
  roundHeader: BracketRoundHeaderComponent<TRoundData, TMatchData>;
  match: BracketMatchComponent<TRoundData, TMatchData>;
  finalMatch: BracketMatchComponent<TRoundData, TMatchData>;
  continue?: BracketContinueComponent<TRoundData, TMatchData>;
};
