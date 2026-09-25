import { expect, type Page } from '@playwright/test';

export type CspViolation = {
  directive: string;
  blockedURI: string;
  sample: string;
  source: string;
};

declare global {
  interface Window {
    __cspViolations: CspViolation[];
  }
}

export const watchCsp = async (page: Page) => {
  const consoleMessages: string[] = [];

  page.on('console', (message) => {
    if (message.text().includes('Content Security Policy')) consoleMessages.push(message.text());
  });

  await page.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (event) => {
      window.__cspViolations.push({
        directive: event.effectiveDirective || event.violatedDirective,
        blockedURI: event.blockedURI,
        sample: event.sample,
        source: `${event.sourceFile}:${event.lineNumber}:${event.columnNumber}`,
      });
    });
  });

  return {
    collect: async () => {
      await page.waitForLoadState('load');
      await page.evaluate(
        () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
      );

      return { violations: await page.evaluate(() => window.__cspViolations), consoleMessages };
    },
  };
};

export const describeViolations = (violations: CspViolation[], consoleMessages: string[]) =>
  [
    ...violations.map(
      (v) => `${v.directive} blocked ${v.blockedURI || '(inline)'} sample="${v.sample}" at ${v.source}`,
    ),
    ...consoleMessages.map((message) => `console: ${message}`),
  ].join('\n');

export const expectNoCspViolations = async (csp: Awaited<ReturnType<typeof watchCsp>>) => {
  const { violations, consoleMessages } = await csp.collect();

  expect(violations.length + consoleMessages.length, describeViolations(violations, consoleMessages)).toBe(0);
};
