import { Locator, Page } from '@playwright/test';

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ViewportSize {
  width: number;
  height: number;
}

/**
 * The locator's bounding box. Throws when the element has none, so a gesture never runs on
 * `NaN` coordinates and silently passes.
 */
export async function boxOf(locator: Locator): Promise<Box> {
  const box = await locator.boundingBox();

  if (!box) throw new Error(`${locator} has no bounding box`);

  return box;
}

/** The page viewport size. Throws when the run has no fixed viewport. */
export function viewportOf(page: Page): ViewportSize {
  const viewport = page.viewportSize();

  if (!viewport) throw new Error('the page has no viewport size');

  return viewport;
}
