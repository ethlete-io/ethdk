import { ComponentType } from '@angular/cdk/portal';
import { InputSignal } from '@angular/core';
import { NewBracketMatch, NewBracketRound } from '../../../linked';

export type Dimensions = {
  width: number;
  height: number;
  top: number;
  left: number;
};

export type BracketRoundHeaderComponent<TRoundData, TMatchData> = ComponentType<{
  bracketRound: InputSignal<NewBracketRound<TRoundData, TMatchData>>;
}>;

export type ComponentInputValue<T> = () => {
  [P in keyof T]: T[P] extends InputSignal<infer U> ? U : never;
};

export type BracketMatchComponent<TRoundData, TMatchData> = ComponentType<{
  bracketRound: InputSignal<NewBracketRound<TRoundData, TMatchData>>;
  bracketMatch: InputSignal<NewBracketMatch<TRoundData, TMatchData>>;
}>;

export type BracketComponents<TRoundData, TMatchData> = {
  roundHeader: BracketRoundHeaderComponent<TRoundData, TMatchData>;
  match: BracketMatchComponent<TRoundData, TMatchData>;
  finalMatch: BracketMatchComponent<TRoundData, TMatchData>;
};
