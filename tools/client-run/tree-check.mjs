/**
 * Compares what Studio's tree lists for a run with what the order asked for: each ordered sketch must show up as
 * a sketch row with the ordered number of variants.
 * An entry with `base: true` must override the SDK part: a matched sketch whose target part is a product-own copy
 * is a finding. `parts` is the `/__design/system` part list.
 * `expected` comes from `expect.json` next to the order.
 */
export const treeFindingsOf = ({ expected, sketches, parts = [] }) => {
  const findings = [];
  const add = (seen, cause) => findings.push({ seen, cause });
  for (const order of expected.sketches ?? []) {
    const match = new RegExp(order.match, 'i');
    const found = sketches.filter((sketch) =>
      [sketch.target, sketch.name, sketch.title, ...(sketch.targetParts ?? [])].some(
        (label) => typeof label === 'string' && match.test(label),
      ),
    );
    if (!found.length) {
      add(
        `Im Baum fehlt der bestellte Sketch „${order.label}“.`,
        sketches.length
          ? `Studio listet nur ${sketches.map((sketch) => sketch.target).join(', ')}; keiner passt zu /${order.match}/.`
          : 'Studio listet keinen Sketch; der Agent hat keinen angelegt oder er wurde verworfen.',
      );
      continue;
    }
    const [min, max] = order.variants ?? [1, Infinity];
    for (const sketch of found) {
      const own =
        order.base && parts.find((part) => `${part.layer}/${part.name}` === sketch.target)?.origin === 'product';
      if (own)
        add(
          `Sketch ${sketch.target} ist eine eigene Kopie des Produkts, kein Override des SDK-Bausteins.`,
          `Richtig: et design sketch new ${sketch.target} --override.`,
        );
      if (sketch.variants.length < min || sketch.variants.length > max)
        add(
          `Sketch ${sketch.target} zeigt ${sketch.variants.length} Varianten, bestellt waren ${min === max ? min : `${min} bis ${max}`}.`,
          `Varianten: ${sketch.variants.join(', ')}.`,
        );
    }
  }
  return findings;
};
