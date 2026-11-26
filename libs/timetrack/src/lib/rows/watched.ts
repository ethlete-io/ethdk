import { AgentPromptEvent, CollectedEvent } from '../model/event';

/** A prompt reduced to what decides attention: the session it went to, and the instant it went. */
export type WatchPrompt = { sessionId: string; at: Date };

/**
 * The prompts of a day that say where the user's attention was, oldest first.
 *
 * A prompt an agent gave itself names no attention, because nobody typed it. That is the reading
 * `attendedAt` and `breakWindows` already take of `askedBy`, and this is the third place it decides
 * whether a person was there.
 *
 * A prompt sent from another device carries no presence of its own and still counts here. It says
 * which session the user was on, which is the only question this answers.
 */
export const watchPrompts = (events: readonly CollectedEvent[]): WatchPrompt[] =>
  events
    .filter((event): event is AgentPromptEvent => event.kind === 'agent-prompt' && event.askedBy !== 'machine')
    .map((event) => ({ sessionId: event.sessionId, at: event.at }))
    .sort((left, right) => left.at.getTime() - right.at.getTime());

/**
 * Which of the sessions running at an instant the user's own window was on: the one they prompted
 * last. A prompt holds its session until the user prompts another, so a session nobody has prompted
 * since is running unwatched.
 *
 * It answers among the given sessions rather than over the whole day. The last prompt before an
 * instant often names a session that had already stopped, or one in another checkout entirely, and
 * reading that one would leave the sessions that really ran with no answer at all.
 *
 * Nothing is returned where the user prompted none of them, which every instant before a checkout's
 * first prompt is. What an instant with no evidence of attention books is the caller's decision.
 */
export const watchedAt = (options: {
  prompts: readonly WatchPrompt[];
  among: ReadonlySet<string>;
  at: Date;
}): string | undefined => {
  const at = options.at.getTime();

  for (let index = options.prompts.length - 1; index >= 0; index--) {
    const prompt = options.prompts[index];

    if (!prompt || prompt.at.getTime() > at) continue;
    if (options.among.has(prompt.sessionId)) return prompt.sessionId;
  }

  return undefined;
};
