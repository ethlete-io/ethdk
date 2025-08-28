import { NewBracket } from './linked';

export const createJourneyHighlight = <TRoundData, TMatchData>(bracketData: NewBracket<TRoundData, TMatchData>) => {
  let styles = '';

  for (const participant of bracketData.participants.values()) {
    styles += `
          .et-new-bracket-host:has(.${participant.shortId}:hover) {
            path, .et-bracket-match-container {
                opacity: 0.5;
            }

            .${participant.shortId} {
                opacity: 1 !important;
            }
          }
        `;
  }

  return styles.replace(/\s+/g, ' ').trim();
};
