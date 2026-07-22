import { AngularRenderer } from '@ethlete/core';

const PARTICIPANT_SHORT_ID_PATTERN = /^p\d+$/;

export const JOURNEY_HOVER_HOST_CLASS = 'et-bracket-host--journey-hover';
export const JOURNEY_ACTIVE_ELEMENT_CLASS = 'et-bracket-journey-active';

const getParticipantShortIds = (element: Element | null) =>
  element ? Array.from(element.classList).filter((cls) => PARTICIPANT_SHORT_ID_PATTERN.test(cls)) : [];

export const setupJourneyHighlight = (host: HTMLElement, renderer: AngularRenderer): (() => void) => {
  let activeElements: Element[] = [];
  let activeShortIds: string[] = [];

  const clear = () => {
    if (!activeElements.length) return;

    for (const el of activeElements) {
      renderer.removeClass(el as HTMLElement, JOURNEY_ACTIVE_ELEMENT_CLASS);
    }

    renderer.removeClass(host, JOURNEY_HOVER_HOST_CLASS);
    activeElements = [];
    activeShortIds = [];
  };

  const activate = (shortIds: string[]) => {
    const isSame =
      shortIds.length === activeShortIds.length && shortIds.every((id, index) => id === activeShortIds[index]);

    if (isSame) return;

    clear();

    const elements: Element[] = [];

    for (const shortId of shortIds) {
      // eslint-disable-next-line ethlete/no-dom-query -- runs outside Angular on pointer events; matches are keyed by dynamically generated short-id classes on ngComponentOutlet hosts and raw SVG nodes, unreachable via a directive token
      elements.push(...Array.from(host.querySelectorAll(`.${shortId}`)));
    }

    for (const el of elements) {
      renderer.addClass(el as HTMLElement, JOURNEY_ACTIVE_ELEMENT_CLASS);
    }

    renderer.addClass(host, JOURNEY_HOVER_HOST_CLASS);
    activeElements = elements;
    activeShortIds = shortIds;
  };

  const onMouseOver = (event: Event) => {
    const target = event.target as Element | null;
    // eslint-disable-next-line ethlete/no-dom-query -- pointer hit-testing outside Angular; walks up to the hovered match element or SVG path, which carry no directive token
    const container = target?.closest('.et-bracket-element--match, path') ?? null;
    const shortIds = getParticipantShortIds(container);

    if (shortIds.length) {
      activate(shortIds);
    } else {
      clear();
    }
  };

  const onMouseLeave = () => clear();

  const removeMouseOverListener = renderer.listen(host, 'mouseover', onMouseOver);
  const removeMouseLeaveListener = renderer.listen(host, 'mouseleave', onMouseLeave);

  return () => {
    removeMouseOverListener();
    removeMouseLeaveListener();
    clear();
  };
};
