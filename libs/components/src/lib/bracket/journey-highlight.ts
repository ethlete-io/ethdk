import { Signal } from '@angular/core';
import { AngularRenderer } from '@ethlete/core';
import { Bracket } from './linked';

const PARTICIPANT_SHORT_ID_PATTERN = /^p\d+$/;

export const JOURNEY_HOVER_HOST_CLASS = 'et-bracket-host--journey-hover';
/** Set on top of the hover class while a journey is pinned, so CSS can dim the rest harder. */
export const JOURNEY_FOCUS_HOST_CLASS = 'et-bracket-host--journey-focused';
export const JOURNEY_ACTIVE_ELEMENT_CLASS = 'et-bracket-journey-active';
/** The match a highlighted participant went out in. */
export const JOURNEY_ENDPOINT_ELEMENT_CLASS = 'et-bracket-journey-endpoint';
/** That participant's own row inside it — the one that lost. */
export const JOURNEY_ELIMINATED_ELEMENT_CLASS = 'et-bracket-journey-eliminated';

/**
 * The attribute a card puts on each participant's row so hovering it highlights that participant
 * alone rather than both sides of the match. The shipped `et-match-card` sets it; a card of your own
 * opts in by setting it too, and behaves like the whole-match highlight without it.
 */
export const BRACKET_PARTICIPANT_ATTRIBUTE = 'data-participant-id';

/** The attribute the bracket puts on each match cell, so a journey can name where it ended. */
export const BRACKET_MATCH_ATTRIBUTE = 'data-match-id';

/** What the highlight needs to know about one participant to draw their journey. */
export type BracketJourneyParticipant = {
  id: string;
  /** The `p<n>` class the grid marks this participant's matches and connectors with. */
  shortId: string;
  /** The match their run ended in, or `null` while they are still in the tournament. */
  eliminatedAtMatchId: string | null;
};

export type SetupJourneyHighlightConfig = {
  host: HTMLElement;
  renderer: AngularRenderer;
  /** Read on each pointer event rather than at setup, so new bracket data needs no new listeners. */
  participants: Signal<BracketJourneyParticipant[]>;
  /** Called when the bracket itself drops the pin — Escape, or a click on empty bracket space. */
  onFocusChange: (participantId: string | null) => void;
};

/** Lets the component push `focusedParticipantId` in, and tear the listeners down. */
export type JourneyHighlightController = {
  setFocused: (participantId: string | null) => void;
  destroy: () => void;
};

/**
 * Reduces the linked bracket to what the highlight reads on a pointer event.
 *
 * A participant is out when every match of theirs is decided and the last of them is one they lost —
 * both halves matter: a pending lower-bracket match means the loss above it wasn't the end, and a
 * champion who dropped a set in the winners bracket lost a match without ever going out.
 *
 * @internal
 */
export const createBracketJourneyParticipants = <TRoundData, TMatchData>(
  bracket: Bracket<TRoundData, TMatchData>,
): BracketJourneyParticipant[] =>
  Array.from(bracket.participants.values()).map((participant) => {
    const matches = Array.from(participant.matches.values());
    const lastMatch = matches[matches.length - 1];
    const isOut = !!lastMatch && matches.every((match) => !!match.winner) && lastMatch.winner?.id !== participant.id;

    return {
      id: participant.id,
      shortId: participant.shortId,
      eliminatedAtMatchId: isOut ? lastMatch.id : null,
    };
  });

/**
 * `:focus-visible` is what tells a tab from a click, but not every engine a test or an old browser runs
 * in can match it — and an unknown pseudo-class throws rather than returning `false`.
 */
const isFocusVisible = (element: Element) => {
  try {
    return element.matches(':focus-visible');
  } catch {
    return false;
  }
};

const getParticipantShortIds = (element: Element | null) =>
  element ? Array.from(element.classList).filter((cls) => PARTICIPANT_SHORT_ID_PATTERN.test(cls)) : [];

export const setupJourneyHighlight = (config: SetupJourneyHighlightConfig): JourneyHighlightController => {
  const { host, renderer, participants, onFocusChange } = config;

  // Every class this module added, with the element it went on: an endpoint match carries a second
  // class on top of the journey one, so removing by element alone would leave one of them behind.
  let activeMarks: { element: Element; className: string }[] = [];
  let renderedKey = '';
  let renderedPinned = false;

  /** The transient journey under the pointer or the focus ring. */
  let previewed: BracketJourneyParticipant[] = [];
  /** The pinned one, which outranks it until it is dropped. */
  let focused: BracketJourneyParticipant | null = null;
  let stopListeningForEscape: (() => void) | null = null;

  const clear = () => {
    for (const { element, className } of activeMarks) {
      renderer.removeClass(element as HTMLElement, className);
    }

    renderer.removeClass(host, JOURNEY_HOVER_HOST_CLASS);
    renderer.removeClass(host, JOURNEY_FOCUS_HOST_CLASS);
    activeMarks = [];
    renderedKey = '';
    renderedPinned = false;
  };

  const mark = (element: Element, className: string) => {
    renderer.addClass(element as HTMLElement, className);
    activeMarks.push({ element, className });
  };

  /** Crosses out the losing row in the match a participant went out in, and stops there. */
  const markElimination = (participant: BracketJourneyParticipant) => {
    if (!participant.eliminatedAtMatchId) return;

    // eslint-disable-next-line ethlete/no-dom-query -- runs outside Angular on pointer events over cells rendered by ngComponentOutlet, which carry no directive token; matching the attribute in JS rather than in the selector keeps an id with a quote in it from breaking the query
    const cells = Array.from(host.querySelectorAll(`[${BRACKET_MATCH_ATTRIBUTE}]`));

    for (const cell of cells) {
      if (cell.getAttribute(BRACKET_MATCH_ATTRIBUTE) !== participant.eliminatedAtMatchId) continue;

      mark(cell, JOURNEY_ENDPOINT_ELEMENT_CLASS);

      // eslint-disable-next-line ethlete/no-dom-query -- same: the rows belong to whichever card the consumer plugged in
      for (const row of Array.from(cell.querySelectorAll(`[${BRACKET_PARTICIPANT_ATTRIBUTE}]`))) {
        if (row.getAttribute(BRACKET_PARTICIPANT_ATTRIBUTE) === participant.id) {
          mark(row, JOURNEY_ELIMINATED_ELEMENT_CLASS);
        }
      }
    }
  };

  /** Draws whichever journey is in effect — the pin if there is one, the preview otherwise. */
  const render = () => {
    const journey = focused ? [focused] : previewed;
    const pinned = !!focused;
    const key = journey.map((participant) => participant.shortId).join(' ');

    if (key === renderedKey && pinned === renderedPinned) return;

    clear();

    if (!key) return;

    for (const participant of journey) {
      // eslint-disable-next-line ethlete/no-dom-query -- matches are keyed by dynamically generated short-id classes on ngComponentOutlet hosts and raw SVG nodes, unreachable via a directive token
      for (const element of Array.from(host.querySelectorAll(`.${participant.shortId}`))) {
        mark(element, JOURNEY_ACTIVE_ELEMENT_CLASS);
      }

      markElimination(participant);
    }

    renderer.addClass(host, JOURNEY_HOVER_HOST_CLASS);

    if (pinned) renderer.addClass(host, JOURNEY_FOCUS_HOST_CLASS);

    renderedKey = key;
    renderedPinned = pinned;
  };

  /** The journey a pointer or focus ring on this element is asking about. */
  const journeyAt = (target: Element | null): BracketJourneyParticipant[] => {
    const known = participants();

    // A participant's own row wins over the match around it: hovering one side of a card is a question
    // about that side, and answering it with both journeys is the thing this replaced.
    // eslint-disable-next-line ethlete/no-dom-query -- pointer hit-testing outside Angular; the row is part of whichever card the consumer plugged in
    const row = target?.closest(`[${BRACKET_PARTICIPANT_ATTRIBUTE}]`) ?? null;
    const rowParticipant = row
      ? known.find((participant) => participant.id === row.getAttribute(BRACKET_PARTICIPANT_ATTRIBUTE))
      : undefined;

    if (rowParticipant) return [rowParticipant];

    // Card chrome or a connector line: both participants, as before.
    // eslint-disable-next-line ethlete/no-dom-query -- walks up to the hovered match element or SVG path, which carry no directive token
    const container = target?.closest('.et-bracket-element--match, path') ?? null;

    return getParticipantShortIds(container)
      .map((shortId) => known.find((participant) => participant.shortId === shortId))
      .filter((participant) => !!participant);
  };

  const preview = (journey: BracketJourneyParticipant[]) => {
    previewed = journey;
    render();
  };

  const onKeyDown = (event: Event) => {
    if ((event as KeyboardEvent).key !== 'Escape' || !focused) return;

    setFocused(null);
    onFocusChange(null);
  };

  const setFocused = (participantId: string | null) => {
    const next = participantId ? (participants().find((p) => p.id === participantId) ?? null) : null;

    if (next?.id === focused?.id) return;

    focused = next;

    // On the document, and only while something is pinned. The pin is usually set from a control
    // *outside* the bracket (a participants list), so focus is rarely inside it — a listener on the host
    // would mean Escape worked only in the one case where the user had already tabbed into the bracket.
    stopListeningForEscape?.();
    stopListeningForEscape = focused ? renderer.listen(host.ownerDocument, 'keydown', onKeyDown) : null;

    render();
  };

  const onMouseOver = (event: Event) => preview(journeyAt(event.target as Element | null));

  const onMouseLeave = () => preview([]);

  // Tabbing to a linked card previews both its journeys — the same affordance a pointer gets, for the
  // one element in a cell that can hold focus. Never pins: the card's own click is its click.
  const onFocusIn = (event: Event) => {
    const target = event.target as Element | null;

    preview(target && isFocusVisible(target) ? journeyAt(target) : []);
  };

  const onFocusOut = () => preview([]);

  // Clicking past the cards drops the pin. A click on a cell is left alone: it belongs to whatever the
  // card does with it, and a pin that rides on a card tap is the surprise this feature avoids.
  const onClick = (event: Event) => {
    const target = event.target as Element | null;

    // eslint-disable-next-line ethlete/no-dom-query -- hit-testing outside Angular against outlet-rendered cells
    if (target?.closest('.et-bracket-element--match')) return;
    if (!focused) return;

    setFocused(null);
    onFocusChange(null);
  };

  const teardowns = [
    renderer.listen(host, 'mouseover', onMouseOver),
    renderer.listen(host, 'mouseleave', onMouseLeave),
    renderer.listen(host, 'focusin', onFocusIn),
    renderer.listen(host, 'focusout', onFocusOut),
    renderer.listen(host, 'click', onClick),
  ];

  return {
    setFocused,
    destroy: () => {
      for (const teardown of teardowns) teardown();

      stopListeningForEscape?.();
      stopListeningForEscape = null;
      clear();
    },
  };
};
