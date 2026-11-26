const SDK_ERROR = /\b(ET\d+)\b:?\s*([^\n]*)/;

const textOf = (value: unknown) => (value instanceof Error ? value.message : String(value));

export const sdkErrorLineOf = (args: unknown[]) => {
  const match = SDK_ERROR.exec(args.map(textOf).join(' '));

  return match ? `${match[1]}: ${match[2] ?? ''}`.trim() : null;
};

export const watchSdkErrors = (target: { error: (...args: unknown[]) => void }) => {
  const found = new Set<string>();
  const error = target.error.bind(target);

  target.error = (...args: unknown[]) => {
    const line = sdkErrorLineOf(args);

    if (line) found.add(line);

    error(...args);
  };

  return () => {
    const lines = [...found];

    found.clear();

    return lines.length === 0 ? null : `the test logged SDK errors:\n${lines.map((line) => `  ${line}`).join('\n')}`;
  };
};
