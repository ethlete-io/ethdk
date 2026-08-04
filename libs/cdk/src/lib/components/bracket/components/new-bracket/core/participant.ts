import { BracketDataSource } from '../integrations';
import { BracketMap } from './bracket-map';
import { BracketMatchId } from './match';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export type MatchParticipantId = string & { __brand: 'MatchParticipantId' };
/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export type MatchParticipantShortId = string & { __brand: 'MatchParticipantShortId' };

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export type NewBracketParticipantBase = {
  id: MatchParticipantId;
  shortId: MatchParticipantShortId;
};

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export type NewBracketParticipantWithRelationsBase = NewBracketParticipantBase & {
  matchIds: BracketMatchId[];
};

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const createParticipantsMapBase = <TRoundData, TMatchData>(
  source: BracketDataSource<TRoundData, TMatchData>,
) => {
  const map: BracketMap<MatchParticipantId, NewBracketParticipantWithRelationsBase> = new BracketMap();

  const participantIds = source.matches
    .map((m) => [m.home, m.away])
    .flat()
    .filter((p) => !!p) as MatchParticipantId[];

  for (const [index, participantId] of participantIds.entries()) {
    const participantBase: NewBracketParticipantWithRelationsBase = {
      id: participantId as MatchParticipantId,
      shortId: `p${index}` as MatchParticipantShortId,
      matchIds: source.matches
        .filter((m) => m.home === participantId || m.away === participantId)
        .map((m) => m.id as BracketMatchId),
    };

    map.set(participantId, participantBase);
  }

  return map;
};
