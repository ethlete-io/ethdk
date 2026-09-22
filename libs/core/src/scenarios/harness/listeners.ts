export type ListenerTargetName = 'document' | 'window';

export type ListenerRecord = {
  target: ListenerTargetName;
  type: string;
  capture: boolean;
  once: boolean;
  listener: EventListenerOrEventListenerObject;
};

const readCapture = (options: boolean | AddEventListenerOptions | EventListenerOptions | undefined) =>
  typeof options === 'boolean' ? options : !!options?.capture;

/**
 * Counts what is added to and removed from `document` and `window`, so a scenario can tell which
 * listeners outlived it. A `once` listener leaves the record when it fires.
 */
export const trackListeners = () => {
  const records: ListenerRecord[] = [];
  const restores: Array<() => void> = [];

  const find = (target: ListenerTargetName, type: string, listener: unknown, capture: boolean) =>
    records.findIndex(
      (record) =>
        record.target === target && record.type === type && record.listener === listener && record.capture === capture,
    );

  const patch = (name: ListenerTargetName, target: EventTarget) => {
    const originalAdd = target.addEventListener;
    const originalRemove = target.removeEventListener;
    const onceWrappers = new Map<ListenerRecord, EventListener>();

    target.addEventListener = function (
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | AddEventListenerOptions,
    ) {
      if (!listener) return originalAdd.call(this, type, listener, options);

      const capture = readCapture(options);
      const once = typeof options === 'object' && !!options.once;

      if (find(name, type, listener, capture) !== -1) return originalAdd.call(this, type, listener, options);

      const record: ListenerRecord = { target: name, type, capture, once, listener };
      records.push(record);

      if (!once) return originalAdd.call(this, type, listener, options);

      const wrapper: EventListener = function (this: unknown, event) {
        const index = records.indexOf(record);
        if (index !== -1) records.splice(index, 1);
        onceWrappers.delete(record);

        if (typeof listener === 'function') listener.call(this, event);
        else listener.handleEvent(event);
      };
      onceWrappers.set(record, wrapper);

      return originalAdd.call(this, type, wrapper, options);
    };

    target.removeEventListener = function (
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | EventListenerOptions,
    ) {
      const index = find(name, type, listener, readCapture(options));

      if (index === -1) return originalRemove.call(this, type, listener, options);

      const [record] = records.splice(index, 1);
      const wrapper = record ? onceWrappers.get(record) : undefined;

      if (record) onceWrappers.delete(record);

      return originalRemove.call(this, type, wrapper ?? listener, options);
    };

    restores.push(() => {
      target.addEventListener = originalAdd;
      target.removeEventListener = originalRemove;
    });
  };

  // jsdom's selector engine (@asamuzakjp/dom-selector) adds nine window listeners on the document's
  // first query and never removes them; run that query before counting starts.
  document.querySelector('body');

  patch('document', document);
  patch('window', window);

  return {
    records: (): readonly ListenerRecord[] => [...records],
    restore: () => restores.splice(0).forEach((restore) => restore()),
  };
};
