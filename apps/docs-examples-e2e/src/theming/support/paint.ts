import { Locator, Page } from '@playwright/test';

export type Paint = { background: [number, number, number]; color: string };

export const NO_TRANSITIONS = '*, *::before, *::after { transition: none !important; animation: none !important; }';

export const readPaint = (target: Locator): Promise<Paint> =>
  target.evaluate((element) => {
    const canvas = document.createElement('canvas');

    canvas.width = 1;
    canvas.height = 1;

    const context = canvas.getContext('2d', { willReadFrequently: true });

    if (!context) throw new Error('No 2d canvas context');

    const chain: Element[] = [];

    for (let node: Element | null = element; node; node = node.parentElement) chain.unshift(node);

    context.fillStyle = 'rgb(255 255 255)';
    context.fillRect(0, 0, 1, 1);

    for (const node of chain) {
      context.fillStyle = getComputedStyle(node).backgroundColor;
      context.fillRect(0, 0, 1, 1);
    }

    const [red = 0, green = 0, blue = 0] = context.getImageData(0, 0, 1, 1).data;

    return { background: [red, green, blue], color: getComputedStyle(element).color };
  });

export const differs = (a: Paint, b: Paint) =>
  a.color !== b.color || a.background.some((channel, index) => Math.abs(channel - (b.background[index] ?? 0)) >= 2);

export const restPointer = (page: Page) => page.mouse.move(1, 1);
