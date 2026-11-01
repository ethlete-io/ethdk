const SDK_ERROR = /\b(ET\d+)\b:?\s*([^\n]*)/;

type ErrorPage = {
  on(event: 'console', listener: (message: { type(): string; text(): string }) => void): unknown;
  on(event: 'pageerror', listener: (error: Error) => void): unknown;
};

export const sdkErrorLineOf = (text: string) => {
  const match = SDK_ERROR.exec(text);

  return match ? `${match[1]}: ${match[2] ?? ''}`.trim() : null;
};

export const watchSdkErrors = (page: ErrorPage) => {
  const found = new Set<string>();
  const collect = (text: string) => {
    const line = sdkErrorLineOf(text);

    if (line) found.add(line);
  };

  page.on('console', (message) => message.type() === 'error' && collect(message.text()));
  page.on('pageerror', (error) => collect(error.message));

  return (where: string) =>
    found.size === 0 ? null : `${where} logged SDK errors:\n${[...found].map((line) => `  ${line}`).join('\n')}`;
};
