import { AddressInfo } from 'net';
import { chromiumOf } from '../browser';
import { DesignConfig } from '../paths';
import { createDesignServer } from '../serve';
import { awaitFonts, createDrawQueue, DRAW_TIMEOUT_MS } from '../thumb';
import { StartHarnessServer, withHarnessUrl } from './harness-server';
import { LiveError, liveSpecOf, openLivePage } from './live-compare';
import { ResolvedProduct } from './resolve-product';
import { settledPanesOf } from './settled-panes';
import { partCoverOf, regionTextOf, UncoveredRegion, uncoveredRegionsOnPage } from './uncovered-regions';

export type UncoveredFinding = { region: UncoveredRegion; states: string[] };

/** Groups the regions each live state reports, so a region every state shows is one finding listing those states. */
export const uncoveredFindingsOf = (found: { state: string; regions: UncoveredRegion[] }[]): UncoveredFinding[] => {
  const findings = new Map<string, UncoveredFinding>();

  for (const { state, regions } of found)
    for (const region of regions) {
      const key = JSON.stringify(region);
      const finding = findings.get(key) ?? { region, states: [] };

      finding.states.push(state);
      findings.set(key, finding);
    }

  return [...findings.values()];
};

/** The report line of one finding. */
export const uncoveredFindingLineOf = ({ region, states }: UncoveredFinding) =>
  `UNCOVERED: ${regionTextOf(region)} in ${states.join(', ')}`;

/**
 * Opens every live state of the product's live spec on the app's real page and reports each visible region that no
 * part component and no `partless` selector of the spec covers.
 */
export const liveUncoveredOf = async (options: {
  target: string;
  config: DesignConfig;
  product: ResolvedProduct;
  url?: string;
  start?: StartHarnessServer;
}): Promise<{ findings: UncoveredFinding[]; problems: string[] } | string> => {
  const { target, config, product } = options;
  const live = liveSpecOf({ target, product });

  if (typeof live === 'string') return live;

  const { spec, dir } = live;
  const presetName = Object.keys(product.presets)[0] ?? '';
  const presetSize = product.presets[presetName];

  if (presetSize?.height === undefined) return `the product has no preset "${presetName}" with a height`;
  if (!(await chromiumOf(target))) return 'the live check needs playwright or playwright-core in the checkout';

  const size = { width: presetSize.width, height: presetSize.height };
  const parts = partCoverOf({ target, product });

  return withHarnessUrl({
    target,
    product,
    url: options.url,
    start: options.start,
    run: async (url) => {
      const queue = createDrawQueue({ target });
      const server = await createDesignServer({ target, config, listen: true, port: 0 });

      try {
        await server.listen();

        const base = `http://localhost:${(server.httpServer?.address() as AddressInfo).port}`;
        const found: { state: string; regions: UncoveredRegion[] }[] = [];
        const problems: string[] = [];

        for (const [name, page] of Object.entries(spec.pages))
          for (const [stateName, state] of Object.entries(page.states)) {
            const label = `${name} ${stateName}`;
            const regions = await queue
              .run(async (browser) => {
                const context = await browser.newContext({
                  viewport: size,
                  deviceScaleFactor: 1,
                  ...(spec.now !== undefined && { timezoneId: 'UTC' }),
                });

                try {
                  const opened = await openLivePage({
                    context,
                    url,
                    size,
                    spec,
                    dir,
                    page,
                    state,
                    server: base,
                    checkout: target,
                    timeout: DRAW_TIMEOUT_MS,
                  });

                  await opened.page.mouse.move(-1, -1);
                  await awaitFonts(opened.page);
                  await opened.page
                    .waitForLoadState('networkidle', { timeout: DRAW_TIMEOUT_MS })
                    .catch(() => undefined);
                  await settledPanesOf({ page: opened.page, count: 0, timeout: DRAW_TIMEOUT_MS });

                  return await uncoveredRegionsOnPage({ page: opened.page, parts, partless: spec.partless ?? [] });
                } finally {
                  await context.close();
                }
              })
              .catch((error: unknown) => (error instanceof LiveError ? error.message : Promise.reject(error)));

            if (typeof regions === 'string') problems.push(`${label}: ${regions}`);
            else found.push({ state: label, regions });
          }

        return { findings: uncoveredFindingsOf(found), problems };
      } finally {
        await queue.close();
        await server.close();
      }
    },
  });
};
