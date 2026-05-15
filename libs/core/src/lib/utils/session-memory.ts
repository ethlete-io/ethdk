export type CreateSessionMemoryConfig<TValue> = {
  key: string;
  parse: (storedValue: string) => TValue | null;
  serialize: (value: TValue) => string;
};

export const createAutoSessionMemoryKey = ({ element, prefix }: { element: HTMLElement; prefix: string }) => {
  const pathSegments: string[] = [];
  let currentElement: HTMLElement | null = element;

  while (currentElement) {
    const currentElementName = currentElement.localName;
    const parentElement: HTMLElement | null = currentElement.parentElement;

    if (!parentElement) {
      pathSegments.unshift(currentElementName);

      break;
    }

    const siblingElements = Array.from(parentElement.children as HTMLCollectionOf<HTMLElement>);
    const siblingIndex = siblingElements.indexOf(currentElement);

    pathSegments.unshift(`${currentElementName}[${siblingIndex}]`);
    currentElement = parentElement;
  }

  const locationPath = element.ownerDocument.defaultView?.location.pathname ?? 'root';

  return `${prefix}:${locationPath}:${pathSegments.join('/')}`;
};

export const canUseSessionMemory = () => {
  try {
    if (typeof globalThis.window === 'undefined') {
      return false;
    }

    if (typeof globalThis.document === 'undefined') {
      return false;
    }

    return globalThis.sessionStorage != null;
  } catch {
    return false;
  }
};

const getSessionStorage = () => {
  if (!canUseSessionMemory()) {
    return null;
  }

  return globalThis.sessionStorage;
};

export const createSessionMemory = <TValue>({ key, parse, serialize }: CreateSessionMemoryConfig<TValue>) => {
  const read = () => {
    const sessionStorage = getSessionStorage();

    if (!sessionStorage) {
      return null;
    }

    try {
      const storedValue = sessionStorage.getItem(key);

      if (storedValue === null) {
        return null;
      }

      return parse(storedValue);
    } catch {
      return null;
    }
  };

  const write = (value: TValue) => {
    const sessionStorage = getSessionStorage();

    if (!sessionStorage) {
      return false;
    }

    try {
      sessionStorage.setItem(key, serialize(value));

      return true;
    } catch {
      return false;
    }
  };

  const remove = () => {
    const sessionStorage = getSessionStorage();

    if (!sessionStorage) {
      return false;
    }

    try {
      sessionStorage.removeItem(key);

      return true;
    } catch {
      return false;
    }
  };

  return {
    read,
    write,
    remove,
  };
};
