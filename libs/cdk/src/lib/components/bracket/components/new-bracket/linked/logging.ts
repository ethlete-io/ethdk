import { NewBracket } from './bracket';

export const logRoundRelations = (bracketData: NewBracket<unknown, unknown>) => {
  for (const round of bracketData.rounds.values()) {
    const relation = round.relation;

    switch (relation.type) {
      case 'nothing-to-one':
        console.log(`START: ${round.name} -> ${relation.nextRound.name} (F: ${relation.nextRoundMatchFactor})`);
        break;
      case 'one-to-nothing':
        console.log(
          `${relation.previousRound.name} (F: ${relation.previousRoundMatchFactor}) <- ENDING: ${round.name}`,
        );
        break;
      case 'one-to-one':
        console.log(
          `${relation.previousRound.name} (F: ${relation.previousRoundMatchFactor}) <- ${round.name} -> ${relation.nextRound.name} (F: ${relation.nextRoundMatchFactor})`,
        );
        break;
      case 'two-to-one':
        console.log(
          `MERGER: ${relation.previousUpperRound.name} (F: ${relation.previousUpperRoundMatchFactor}) AND ${relation.previousLowerRound.name} (F: ${relation.previousLowerRoundMatchFactor}) <- ${round.name} -> ${relation.nextRound.name} (F: ${relation.nextRoundMatchFactor})`,
        );
        break;
      case 'two-to-nothing':
        console.log(
          `MERGER: ${relation.previousUpperRound.name} (F: ${relation.previousUpperRoundMatchFactor}) AND ${relation.previousLowerRound.name} (F: ${relation.previousLowerRoundMatchFactor}) <- ENDING: ${round.name}`,
        );
        break;
    }
  }
};
