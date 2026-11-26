/**
 * Checks that each ordered sketch variant has a state for every trap `expect.json` lists for its part.
 * A state covers a trap when any condition of the trap holds: `shows` matches a visible text or an image file name
 * of its frame, `state` matches its name, or its frame is at most `maxWidth` / at least `minWidth` wide.
 * `shots` are the judge's shots (or `shots.json`); a sketch the tree lacks is the tree check's finding.
 */
export const trapFindingsOf = ({ expected, shots }) => {
  const findings = [];
  const views = shots.filter((shot) => shot.sketch && shot.state);
  for (const order of expected.sketches ?? []) {
    if (!order.traps?.length) continue;
    const match = new RegExp(order.match, 'i');
    const bySketch = Map.groupBy(
      views.filter((view) => match.test(view.sketch)),
      (view) => view.sketch,
    );
    for (const [sketch, sketchViews] of bySketch) {
      const byVariant = Map.groupBy(sketchViews, (view) => view.variant);
      for (const trap of order.traps) {
        const missing = [...byVariant].filter(([, states]) => !states.some((view) => covers(trap, view)));
        if (!missing.length) continue;
        const variants = missing.map(([variant]) => variant);
        findings.push({
          seen: `${order.label} (${sketch}${byVariant.size > 1 ? `, Variante ${variants.join(', ')}` : ''}): Falle „${trap.name}“ hat keinen Zustand.`,
          cause: `Das alte Design zeigt „${trap.name}“ (${trap.source}); kein Zustand des Sketches zeigt es.`,
        });
      }
    }
  }
  return findings;
};

const covers = (trap, view) => {
  const probe = view.frame?.probe;
  const width = probe?.viewport?.width;
  if (trap.state && new RegExp(trap.state, 'i').test(view.state)) return true;
  if (width !== undefined && trap.maxWidth !== undefined && width <= trap.maxWidth) return true;
  if (width !== undefined && trap.minWidth !== undefined && width >= trap.minWidth) return true;
  if (!trap.shows || !probe) return false;
  const shows = new RegExp(trap.shows, 'i');
  return [
    ...(probe.texts ?? []).map((text) => text.text),
    ...(probe.images ?? []).map((image) => image.src.split('/').pop()),
  ].some((seen) => shows.test(seen));
};

/**
 * Reports each state of a part with `logoWhereExists` that shows an image of a title whose `katalog.json` entry has a
 * logo, without that logo image.
 */
export const logoFindingsOf = ({ expected, shots, katalog }) => {
  const logos = new Map(
    katalog.filter((entry) => entry.logo).map((entry) => [entry.logo.replace(/-logo\.png$/, ''), entry]),
  );
  const findings = [];
  for (const order of expected.sketches ?? []) {
    if (!order.logoWhereExists) continue;
    const match = new RegExp(order.match, 'i');
    const missing = Map.groupBy(
      shots
        .filter((shot) => shot.sketch && shot.state && match.test(shot.sketch))
        .flatMap((view) => {
          const files = (view.frame?.probe?.images ?? []).map((image) => image.src.split('/').pop());
          return [...new Set(files.map((file) => file.replace(/-(plakat|plakat-klein|hintergrund)\.\w+$/, '')))]
            .filter((slug) => logos.has(slug) && !files.includes(logos.get(slug).logo))
            .map((slug) => ({ view, title: logos.get(slug).title }));
        }),
      ({ view, title }) => `${view.sketch}|${view.variant}|${title}`,
    );
    for (const hits of missing.values()) {
      const { view, title } = hits[0];
      findings.push({
        seen: `${order.label} (${view.sketch}, Variante ${view.variant}): „${title}“ zeigt den Titel ohne sein Logo-Bild (${hits.map((hit) => hit.view.state).join(', ')}).`,
        cause: `Der Auftrag will den Titel als Logo-Bild, Text nur als Rückfall; für „${title}“ liegt ein Logo in \`~/bilder-von-tom\`.`,
      });
    }
  }
  return findings;
};
