export type FlowLink = { from: string; to: string };

export type CanvasLine = FlowLink & { label?: string };

/**
 * The column of each frame along the links, left to right: a frame sits one column after the
 * furthest frame that links to it. A link that closes a cycle, and a link of a frame to itself,
 * moves nothing.
 */
export const flowColumnsOf = (ids: string[], links: FlowLink[]): Map<string, number> => {
  const known = new Set(ids);
  const outgoing = new Map(ids.map((id) => [id, [] as string[]]));

  for (const { from, to } of links) if (known.has(from) && known.has(to) && from !== to) outgoing.get(from)?.push(to);

  const forward: FlowLink[] = [];
  const state = new Map<string, 'open' | 'done'>();
  const visit = (id: string) => {
    state.set(id, 'open');

    for (const to of outgoing.get(id) ?? []) {
      if (state.get(to) === 'open') continue;

      forward.push({ from: id, to });

      if (!state.has(to)) visit(to);
    }

    state.set(id, 'done');
  };

  ids.forEach((id) => state.has(id) || visit(id));

  const columns = new Map<string, number>();
  const columnOf = (id: string): number => {
    const known = columns.get(id);

    if (known !== undefined) return known;

    const column = Math.max(0, ...forward.filter((link) => link.to === id).map((link) => columnOf(link.from) + 1));

    columns.set(id, column);

    return column;
  };

  ids.forEach(columnOf);

  return columns;
};
