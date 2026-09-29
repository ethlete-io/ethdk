import { CollectedEvent, InputEvent } from '../model/event';

/** Whether a prompt was typed at this machine, or sent from somewhere nothing here can observe. */
export type PromptOrigin = 'desk' | 'remote' | 'unknown';

/** How far before a prompt local input still makes it a desk prompt. The host's short idle threshold. */
export const DESK_INPUT_WINDOW_MS = 60_000;

const isInput = (event: CollectedEvent): event is InputEvent => event.source === 'input';

/**
 * Where a prompt came from, read off the short input-idle transitions: `desk` when the seat was
 * touched within `windowMs` before `at`, `remote` when it was not, and `unknown` when the day holds no
 * transition that says what the seat was doing at the start of that window.
 *
 * An `input-idle` that follows another one, with no `input-active` between them, is a notifier that
 * restarted with nobody at the seat and says nothing about input.
 *
 * A prompt is `remote` only inside an idle stretch an `input-active` closes. A restarted notifier's
 * first transition is always `input-idle`, so that closing edge is the proof the app watched the seat
 * the whole time; a stretch the app was closed in reads `unknown`. On a day still being collected,
 * `now` closes a stretch no input event follows yet: the app is watching the seat at that instant.
 */
export const promptOriginAt = (options: {
  events: readonly CollectedEvent[];
  at: Date;
  windowMs?: number;
  now?: Date;
}): PromptOrigin => promptOriginReader(options)(options.at);

/** {@link promptOriginAt} for many prompts over the same events, which it sorts once. */
export const promptOriginReader = (options: {
  events: readonly CollectedEvent[];
  windowMs?: number;
  /** The instant a day still being collected is read at. Left out for a day that is over. */
  now?: Date;
}) => {
  const windowMs = options.windowMs ?? DESK_INPUT_WINDOW_MS;
  const inputs = options.events.filter(isInput).sort((left, right) => left.at.getTime() - right.at.getTime());

  return (at: Date): PromptOrigin => {
    const from = at.getTime() - windowMs;
    const until = at.getTime();

    let active: boolean | undefined;
    let activeAtFrom: boolean | undefined;

    let next: InputEvent | undefined;

    for (const event of inputs) {
      const instant = event.at.getTime();

      if (instant > until) {
        next = event;
        break;
      }

      if (instant >= from) {
        if (event.kind === 'input-active' || active) return 'desk';
      } else {
        activeAtFrom = event.kind === 'input-active';
      }

      active = event.kind === 'input-active';
    }

    if (activeAtFrom === undefined) return 'unknown';
    if (activeAtFrom) return 'desk';

    if (next) return next.kind === 'input-active' ? 'remote' : 'unknown';

    return options.now && until <= options.now.getTime() ? 'remote' : 'unknown';
  };
};
