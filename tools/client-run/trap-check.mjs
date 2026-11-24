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
          cause: `Kein Zustand zeigt ${describe(trap)}; das alte Design (46 B) zeigt sie.`,
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

const describe = (trap) =>
  [
    trap.shows && `/${trap.shows}/`,
    trap.state && `einen Zustand /${trap.state}/`,
    trap.maxWidth !== undefined && `höchstens ${trap.maxWidth} px Breite`,
    trap.minWidth !== undefined && `mindestens ${trap.minWidth} px Breite`,
  ]
    .filter(Boolean)
    .join(' oder ');
