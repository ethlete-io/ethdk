// TODO: This needs to be redone, it's a mess...
export const getIntersectionInfo = (intersections: IntersectionObserverEntry[]) => {
  const reverseIntersections = [...intersections].reverse();
  const firstIntersecting = intersections.find((i) => i.intersectionRatio > 0);
  const lastIntersecting = reverseIntersections.find((i) => i.intersectionRatio > 0);

  const firstIntersectingIndex = intersections.findIndex((i) => i === firstIntersecting);
  const lastIntersectingIndex = intersections.findIndex((i) => i === lastIntersecting);

  if (!firstIntersecting || !lastIntersecting) return null;

  const greaterIntersecting =
    firstIntersecting.intersectionRatio > lastIntersecting.intersectionRatio ? firstIntersecting : lastIntersecting;

  const greaterIntersectingIndex =
    firstIntersecting.intersectionRatio > lastIntersecting.intersectionRatio
      ? firstIntersectingIndex
      : lastIntersectingIndex;

  const hasFullIntersection = intersections.some((i) => i.intersectionRatio === 1);
  const hasMultipleFullIntersections = intersections.filter((i) => i.intersectionRatio === 1).length > 1;

  const firstFullIntersectionIndex = intersections.findIndex((i) => i.intersectionRatio === 1);
  const firstFullIntersection = intersections.find((i) => i.intersectionRatio === 1);

  const lastFullIntersection = reverseIntersections.find((i) => i.intersectionRatio === 1);
  const lastFullIntersectionIndex = intersections.findIndex((i) => i === lastFullIntersection);

  const firstNonIntersectingIndex = intersections.findIndex((i) => i.intersectionRatio === 0);
  const firstNonIntersection = intersections.find((i) => i.intersectionRatio === 0);

  const lastNonIntersection = reverseIntersections.find((i) => i.intersectionRatio === 0);
  const lastNonIntersectingIndex = intersections.findIndex((i) => i === lastNonIntersection);

  return {
    partial: {
      hasAny: !!firstIntersecting || !!lastIntersecting,
      hasMultiple: !!firstIntersecting || (!!lastIntersecting && firstIntersecting !== lastIntersecting),
      first: {
        intersection: firstIntersecting,
        index: firstIntersectingIndex,
      },
      last: {
        intersection: lastIntersecting,
        index: lastIntersectingIndex,
      },
      biggest: {
        intersection: greaterIntersecting,
        index: greaterIntersectingIndex,
      },
    },
    full: {
      hasAny: hasFullIntersection,
      hasMultiple: hasMultipleFullIntersections,
      first: {
        index: firstFullIntersectionIndex,
        intersection: firstFullIntersection,
      },
      last: {
        index: lastFullIntersectionIndex,
        intersection: lastFullIntersection,
      },
    },
    none: {
      first: {
        index: firstNonIntersectingIndex,
        intersection: firstNonIntersection,
      },
      last: {
        index: lastNonIntersectingIndex,
        intersection: lastNonIntersection,
      },
    },
  };
};
