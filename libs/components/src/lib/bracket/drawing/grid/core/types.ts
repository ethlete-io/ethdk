import { InputSignal, Type } from '@angular/core';
import { BracketMatch, BracketRound } from '../../../linked';

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

export type BracketRoundHeaderComponent<TRoundData, TMatchData> = Type<{
  bracketRound: InputSignal<BracketRound<TRoundData, TMatchData>>;
}>;

export type ComponentInputValue<T> = () => {
  [P in keyof T]: T[P] extends InputSignal<infer U> ? U : never;
};

export type BracketMatchComponent<TRoundData, TMatchData> = Type<{
  bracketRound: InputSignal<BracketRound<TRoundData, TMatchData>>;
  bracketMatch: InputSignal<BracketMatch<TRoundData, TMatchData>>;
}>;

export type BracketContinueComponent<TRoundData, TMatchData> = Type<{
  /** The matches whose winners advance to the next competition stage */
  bracketMatches: InputSignal<BracketMatch<TRoundData, TMatchData>[]>;
}>;

export type BracketComponents<TRoundData, TMatchData> = {
  roundHeader: BracketRoundHeaderComponent<TRoundData, TMatchData>;
  match: BracketMatchComponent<TRoundData, TMatchData>;
  finalMatch: BracketMatchComponent<TRoundData, TMatchData>;
  continue?: BracketContinueComponent<TRoundData, TMatchData>;
};
