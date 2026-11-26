export const once = (restore: () => void) => {
  let restored = false;

  return () => {
    if (restored) return;

    restored = true;
    restore();
  };
};

export const installProperty = (holder: object, property: string, value: unknown) => {
  const original = Object.getOwnPropertyDescriptor(holder, property);

  Object.defineProperty(holder, property, { configurable: true, value, writable: true });

  return () => {
    if (original) Object.defineProperty(holder, property, original);
    else Reflect.deleteProperty(holder, property);
  };
};
