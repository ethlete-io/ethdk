import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DESCRIBED = '; check ';
const CATEGORIES = ['elements', 'components', 'foundations', 'pages'];

/** The first part of each product in the checkout's design config whose states describe a check, as `{ product, entry }`. */
export const productEntries = (checkout) => {
  const design = join(checkout, '.ethlete/design');
  const { products = {} } = JSON.parse(readFileSync(join(design, 'config.json'), 'utf8'));

  return Object.keys(products).map((product) => {
    const entry = CATEGORIES.flatMap((category) => {
      const dir = join(design, product, category);

      return existsSync(dir)
        ? readdirSync(dir)
            .sort()
            .map((name) => `${category}/${name}`)
        : [];
    }).find((part) => {
      const source = join(design, product, part, `${part.split('/')[1]}.ts`);

      return existsSync(source) && readFileSync(source, 'utf8').includes(DESCRIBED);
    });

    return { product, entry };
  });
};

/** Opens every product's view and waits for a described state; a product that never shows one is reported with its evidence. */
export const shootProducts = async (page, checkout, timeoutMs = 60_000) => {
  const evidence = { failed: [], console: [] };
  const onFailed = (request) => evidence.failed.push(`${request.url()} ${request.failure()?.errorText ?? ''}`.trim());
  const onResponse = (response) => {
    if (response.status() >= 400) evidence.failed.push(`${response.url()} ${response.status()}`);
  };
  const onConsole = (message) => {
    if (message.type() === 'error') evidence.console.push(message.text());
  };
  const shown = [];
  const missing = [];

  page.on('requestfailed', onFailed);
  page.on('response', onResponse);
  page.on('console', onConsole);
  try {
    for (const { product, entry } of productEntries(checkout)) {
      if (!entry) {
        missing.push(`${product}: no part describes a check`);
        continue;
      }
      evidence.failed.length = 0;
      evidence.console.length = 0;
      await page.evaluate((view) => localStorage.setItem('ethlete-studio.call-view', JSON.stringify(view)), {
        checkout,
        systemProduct: product,
        systemEntry: entry,
      });
      await page.reload();
      try {
        await page.getByText(DESCRIBED).first().waitFor({ timeout: timeoutMs });
        shown.push(product);
      } catch {
        const body = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 1500);

        missing.push(
          `${product} (${entry}) showed no "${DESCRIBED.trim()}" in ${timeoutMs} ms; body: ${body || '(empty)'}; failed requests: ${evidence.failed.join(' | ') || 'none'}; console errors: ${evidence.console.join(' | ') || 'none'}`,
        );
      }
    }
  } finally {
    page.off('requestfailed', onFailed);
    page.off('response', onResponse);
    page.off('console', onConsole);
  }

  return {
    ok: missing.length === 0 && shown.length > 0,
    detail: missing.length ? missing.join('\n') : `every product shows a described state: ${shown.join(', ')}`,
  };
};
