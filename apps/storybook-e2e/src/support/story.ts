import { Locator, Page, expect } from '@playwright/test';

export interface OpenStoryOptions {
  args?: Record<string, string | number | boolean>;
  globals?: Record<string, string>;
}

function serializeParams(record: Record<string, string | number | boolean>): string {
  return Object.entries(record)
    .map(([key, value]) => `${key}:${value}`)
    .join(';');
}

export function storyUrl(id: string, opts: OpenStoryOptions = {}): string {
  const params = new URLSearchParams({ id, viewMode: 'story' });

  if (opts.args) {
    params.set('args', serializeParams(opts.args));
  }

  if (opts.globals) {
    params.set('globals', serializeParams(opts.globals));
  }

  return `/iframe.html?${params.toString()}`;
}

export async function openStory(page: Page, id: string, opts: OpenStoryOptions = {}): Promise<Locator> {
  await page.goto(storyUrl(id, opts), { waitUntil: 'domcontentloaded' });

  await page.waitForSelector('body.sb-show-main, body.sb-show-errordisplay', { timeout: 15_000 });

  if (await page.locator('body.sb-show-errordisplay').count()) {
    throw new Error(`Story "${id}" was not found in this Storybook build. Check the id against /index.json.`);
  }

  const root = page.locator('#storybook-root');
  await expect.poll(() => root.evaluate((el) => el.childElementCount)).toBeGreaterThan(0);

  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(100);

  return root;
}
