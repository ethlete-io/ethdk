/** Paints `body` with the token `--<fill>` over the product's page colour, which shows when the product has no such token. */
export const paintFill = (body: HTMLElement, fill: string) => {
  body.style.backgroundImage = `linear-gradient(var(--${fill}), var(--${fill}))`;
};
