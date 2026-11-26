/**
 * Answers a function that moves the `@font-face` rules of the sheets it is given into style elements of their own in
 * `document`, kept as long as a later call names the same rule, and answers the sheets without those rules. A sheet
 * added again makes its faces anew and unloaded, so text drawn right after it measures the fallback font.
 */
export const keptFacesOf = (document: Document) => {
  const kept = new Map<string, HTMLStyleElement>();

  return (sheets: string[]) => {
    const face = /@font-face\s*\{[^}]*\}/giu;
    const faces = new Set(sheets.flatMap((sheet) => sheet.match(face) ?? []));

    for (const [rule, style] of kept) {
      if (faces.has(rule)) continue;

      style.remove();
      kept.delete(rule);
    }

    for (const rule of faces) {
      if (kept.has(rule)) continue;

      const style = document.createElement('style');

      style.textContent = rule;
      document.head.append(style);
      kept.set(rule, style);
    }

    return sheets.map((sheet) => sheet.replace(face, ''));
  };
};
