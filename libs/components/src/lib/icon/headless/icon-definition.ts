export type IconDefinition = {
  name: string;
  /**
   * Optional style variant (e.g. `'solid'`, `'light'`, `'regular'`). Lets the same icon
   * `name` exist in several styles without encoding the style into the name. Icons
   * registered without a variant are matched by their bare name.
   */
  variant?: string;
  /**
   * The SVG markup. It is rendered as-is without sanitising, so it must be trusted, build-time markup -
   * never a string from a CMS, an API or user input.
   */
  data: string;
};
