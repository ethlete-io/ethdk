type MediaListener = (event: { matches: boolean; media: string }) => void;

export const createFakeViewport = (initialWidth: number) => {
  let width = initialWidth;
  const lists: { media: string; matches: boolean; listeners: Set<MediaListener> }[] = [];
  const evaluate = (media: string) =>
    media.split(' and ').every((part) => {
      const [, feature, value] = /^\(([\w-]+):\s*([\d.]+)px\)$/.exec(part.trim()) ?? [];

      if (feature === 'min-width') return width >= Number(value);
      if (feature === 'max-width') return width <= Number(value);

      return false;
    });

  const matchMedia = (media: string) => {
    const entry = { media, matches: evaluate(media), listeners: new Set<MediaListener>() };

    lists.push(entry);

    return {
      media,
      get matches() {
        return entry.matches;
      },
      addEventListener: (_: 'change', listener: MediaListener) => entry.listeners.add(listener),
      removeEventListener: (_: 'change', listener: MediaListener) => entry.listeners.delete(listener),
    };
  };

  return {
    install: () => {
      Object.defineProperty(window, 'matchMedia', { configurable: true, value: matchMedia });

      return () => Reflect.deleteProperty(window, 'matchMedia');
    },
    resize: (next: number) => {
      width = next;

      for (const entry of lists) {
        const matches = evaluate(entry.media);

        if (matches === entry.matches) continue;

        entry.matches = matches;
        entry.listeners.forEach((listener) => listener({ matches, media: entry.media }));
      }
    },
  };
};
