export const getFirstAndLastPartialIntersection = (intersections: IntersectionObserverEntry[]) => {
  const firstIntersecting = intersections.find((i) => i.intersectionRatio > 0);
  const lastIntersecting = [...intersections].reverse().find((i) => i.intersectionRatio > 0);

  const firstIntersectingIndex = intersections.findIndex((i) => i === firstIntersecting);
  const lastIntersectingIndex = intersections.findIndex((i) => i === lastIntersecting);

  if (!firstIntersecting || !lastIntersecting) return null;

  const greaterIntersecting =
    firstIntersecting.intersectionRatio > lastIntersecting.intersectionRatio ? firstIntersecting : lastIntersecting;

  const greaterIntersectingIndex =
    firstIntersecting.intersectionRatio > lastIntersecting.intersectionRatio
      ? firstIntersectingIndex
      : lastIntersectingIndex;

  return {
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
  };
};
