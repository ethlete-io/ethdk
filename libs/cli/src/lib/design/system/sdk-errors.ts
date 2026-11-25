const SDK_ERROR = /\b(ET\d+)\b:?\s*([^\n]*)/;

type ErrorPage = {
  on(event: 'console', listener: (message: { type(): string; text(): string }) => void): unknown;
  on(event: 'pageerror', listener: (error: Error) => void): unknown;
};

export const sdkErrorLineOf = (text: string) => {
  const match = SDK_ERROR.exec(text);

  return match ? `${match[1]}: ${match[2] ?? ''}`.trim() : null;
};

export const watchSdkErrorLines = (page: ErrorPage) => {
  const found = new Set<string>();
  const collect = (text: string) => {
    const line = sdkErrorLineOf(text);

    if (line) found.add(line);
  };

  page.on('console', (message) => message.type() === 'error' && collect(message.text()));
  page.on('pageerror', (error) => collect(error.message));

  return {
    lines: () => [...found],
    drain: () => {
      const lines = [...found];

      found.clear();

      return lines;
    },
  };
};

export const watchSdkErrors = (page: ErrorPage) => {
  const watcher = watchSdkErrorLines(page);

  return (where: string) => {
    const lines = watcher.lines();

    return lines.length === 0 ? null : `${where} logged SDK errors:\n${lines.map((line) => `  ${line}`).join('\n')}`;
  };
};

const NETWORK_NOISE = /^Failed to load resource\b/;

const appErrorLineOf = (text: string) => {
  const line =
    text
      .split('\n')
      .find((candidate) => candidate.trim() !== '')
      ?.trim() ?? '';

  return line === '' || NETWORK_NOISE.test(line) || sdkErrorLineOf(text) ? null : line;
};

/**
 * The first line of each distinct uncaught error or `console.error` on `page` that is not an SDK error; a failed
 * resource load is left to the network.
 */
export const watchAppErrorLines = (page: ErrorPage) => {
  const found = new Set<string>();
  const collect = (text: string) => {
    const line = appErrorLineOf(text);

    if (line) found.add(line);
  };

  page.on('console', (message) => message.type() === 'error' && collect(message.text()));
  page.on('pageerror', (error) => collect(error.message));

  return () => [...found];
};
