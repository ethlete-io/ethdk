import { computed, signal } from '@angular/core';

export const createElementDictionary = () => {
  const dictionary = {
    ids: signal<string[]>([]),
    elements: signal<Record<string, HTMLElement>>({}),
  };

  const firstElement = computed(() => {
    const id = dictionary.ids()[0];
    return id ? (dictionary.elements()[id] ?? null) : null;
  });

  const firstId = computed(() => {
    const id = dictionary.ids()[0];
    return id ?? null;
  });

  const ids = computed(() => dictionary.ids());
  const elements = computed(() => ids().map((id) => dictionary.elements()[id]!));

  const isEmpty = computed(() => dictionary.ids().length === 0);

  const has = (id: string) => {
    return dictionary.ids().includes(id);
  };

  const push = (id: string, element: HTMLElement) => {
    dictionary.ids.set([...dictionary.ids(), id]);
    dictionary.elements.set({ ...dictionary.elements(), [id]: element });
  };

  const remove = (id: string) => {
    dictionary.ids.set(dictionary.ids().filter((i) => i !== id));
    dictionary.elements.set(Object.fromEntries(Object.entries(dictionary.elements()).filter(([k]) => k !== id)));
  };

  const get = (id: string) => {
    return dictionary.elements()[id] ?? null;
  };

  return {
    ids,
    elements,
    has,
    get,
    push,
    remove,
    isEmpty,
    firstElement,
    firstId,
  };
};
