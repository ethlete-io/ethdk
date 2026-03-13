const MIN_SNAP_DELTA_PX = 1;

export type ScrollSnapOrigin = 'auto' | 'start' | 'center' | 'end';

export type ScrollSnapTarget = {
  /** The element to snap to. */
  element: HTMLElement;
  /** The resolved alignment to use when scrolling to the element. */
  origin: 'start' | 'center' | 'end';
} | null;

export const getScrollSnapTarget = (
  items: HTMLElement[],
  container: HTMLElement,
  direction: 'horizontal' | 'vertical',
  origin: ScrollSnapOrigin,
  margin = 0,
): ScrollSnapTarget => {
  if (!items.length) return null;

  const containerRect = container.getBoundingClientRect();
  const containerSize = direction === 'horizontal' ? containerRect.width : containerRect.height;

  let bestElement: HTMLElement | null = null;
  let bestOrigin: 'start' | 'center' | 'end' = 'start';
  let bestAbsDelta = Infinity;

  const updateBest = (element: HTMLElement, o: 'start' | 'center' | 'end', delta: number) => {
    const abs = Math.abs(delta);
    if (abs < bestAbsDelta) {
      bestAbsDelta = abs;
      bestElement = element;
      bestOrigin = o;
    }
  };

  for (const item of items) {
    const itemRect = item.getBoundingClientRect();
    const itemSize = direction === 'horizontal' ? itemRect.width : itemRect.height;

    const relativeStart =
      direction === 'horizontal' ? itemRect.left - containerRect.left : itemRect.top - containerRect.top;
    const relativeEnd = relativeStart + itemSize;

    if (itemSize > containerSize) {
      const isStartEdgeVisible = relativeStart >= 0;
      const isEndEdgeVisible = relativeEnd <= containerSize;

      if (!isStartEdgeVisible && !isEndEdgeVisible) continue;

      if (isStartEdgeVisible) {
        updateBest(item, 'start', relativeStart - margin);
      } else {
        updateBest(item, 'end', relativeEnd - containerSize + margin);
      }
      continue;
    }

    const computeDelta = (o: 'start' | 'center' | 'end'): number => {
      switch (o) {
        case 'start':
          return relativeStart - margin;
        case 'end':
          return relativeEnd - containerSize + margin;
        case 'center':
          return relativeStart + itemSize / 2 - containerSize / 2;
      }
    };

    if (origin === 'auto') {
      for (const o of ['start', 'center', 'end'] as const) {
        updateBest(item, o, computeDelta(o));
      }
    } else {
      updateBest(item, origin, computeDelta(origin));
    }
  }

  if (!bestElement || bestAbsDelta < MIN_SNAP_DELTA_PX) return null;

  return { element: bestElement, origin: bestOrigin };
};

export type ScrollContainerTarget = {
  element: HTMLElement;
  origin: 'start' | 'end';
} | null;

export const getScrollContainerTarget = (
  entries: IntersectionObserverEntry[],
  direction: 'start' | 'end',
): ScrollContainerTarget => {
  const firstVisible = entries.find((i) => i.intersectionRatio > 0);
  const lastVisible = [...entries].reverse().find((i) => i.intersectionRatio > 0);
  const relevantEntry = direction === 'start' ? firstVisible : lastVisible;

  if (!relevantEntry) return null;

  const relevantIndex = entries.indexOf(relevantEntry);
  const nextIndex =
    relevantEntry.intersectionRatio !== 1
      ? relevantIndex
      : direction === 'start'
        ? relevantIndex - 1
        : relevantIndex + 1;

  const element = (entries[nextIndex]?.target as HTMLElement) ?? (relevantEntry.target as HTMLElement);

  return { element, origin: direction === 'end' ? 'start' : 'end' };
};

export type ScrollItemTarget = {
  element: HTMLElement;
  index: number;
  origin: 'start' | 'end' | 'center';
} | null;

export const getScrollItemTarget = (
  entries: IntersectionObserverEntry[],
  container: HTMLElement,
  direction: 'start' | 'end',
  scrollOrigin: 'auto' | 'center' | 'start' | 'end',
  axisDirection: 'horizontal' | 'vertical',
): ScrollItemTarget => {
  const firstVisible = entries.find((i) => i.intersectionRatio > 0);
  const lastVisible = [...entries].reverse().find((i) => i.intersectionRatio > 0);

  if (!firstVisible || !lastVisible) return null;

  const firstIndex = entries.indexOf(firstVisible);
  const lastIndex = entries.indexOf(lastVisible);
  const containerRect = container.getBoundingClientRect();

  // Only a single item is visible — it must be oversized (wider/taller than the container).
  if (firstVisible === lastVisible) {
    const itemRect = firstVisible.target.getBoundingClientRect();
    const isStartEdgeVisible =
      axisDirection === 'horizontal'
        ? Math.round(itemRect.left) >= Math.round(containerRect.left)
        : Math.round(itemRect.top) >= Math.round(containerRect.top);
    const isEndEdgeVisible =
      axisDirection === 'horizontal'
        ? Math.round(itemRect.right) <= Math.round(containerRect.right)
        : Math.round(itemRect.bottom) <= Math.round(containerRect.bottom);

    if (!isStartEdgeVisible || !isEndEdgeVisible) {
      if (direction === 'start') {
        if (isStartEdgeVisible) {
          const prevIndex = firstIndex - 1;
          const element = entries[prevIndex]?.target as HTMLElement | undefined;
          if (!element) return null;
          return { element, index: prevIndex, origin: 'end' };
        }
        return { element: firstVisible.target as HTMLElement, index: firstIndex, origin: 'start' };
      } else {
        if (isEndEdgeVisible) {
          const nextIndex = lastIndex + 1;
          const element = entries[nextIndex]?.target as HTMLElement | undefined;
          if (!element) return null;
          return { element, index: nextIndex, origin: 'start' };
        }
        return { element: lastVisible.target as HTMLElement, index: lastIndex, origin: 'end' };
      }
    }
  } else if (scrollOrigin === 'center') {
    const entry = direction === 'start' ? firstVisible : lastVisible;
    const index = direction === 'start' ? firstIndex : lastIndex;
    return { element: entry.target as HTMLElement, index, origin: 'center' };
  }

  const entry = direction === 'start' ? firstVisible : lastVisible;
  const entryIndex = direction === 'start' ? firstIndex : lastIndex;

  if (Math.round(entry.intersectionRatio) === 1) {
    if (direction === 'start' && entryIndex === 0) return null;
    if (direction === 'end' && entryIndex === entries.length - 1) return null;

    const nextIndex = direction === 'start' ? entryIndex - 1 : entryIndex + 1;
    const element = entries[nextIndex]?.target as HTMLElement | undefined;
    if (!element) return null;
    return { element, index: nextIndex, origin: direction };
  }

  return { element: entry.target as HTMLElement, index: entryIndex, origin: direction };
};
