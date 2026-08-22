const SVG_ATTRIBUTE_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '"': '&quot;',
  "'": '&#39;',
  '<': '&lt;',
  '>': '&gt;',
};

/**
 * Escapes a value written into a double-quoted attribute of a hand-built SVG string. The bracket's
 * SVG reaches the DOM through `bypassSecurityTrustHtml`, so every value coming from an input must
 * pass through here or it can close the attribute and open one of its own.
 *
 * @internal
 */
export const escapeSvgAttributeValue = (value: string) =>
  value.replace(/[&"'<>]/g, (character) => SVG_ATTRIBUTE_ESCAPES[character] ?? character);
