const FRAMEWORK_WARNING = /\bNG0\d+/;

export const watchFrameworkWarnings = (target: { warn: (...args: unknown[]) => void }) => {
  const found: string[] = [];
  const warn = target.warn.bind(target);

  target.warn = (...args: unknown[]) => {
    const line = args.map((arg) => (arg instanceof Error ? arg.message : String(arg))).join(' ');

    if (FRAMEWORK_WARNING.test(line)) found.push(line);

    warn(...args);
  };

  return () => {
    const lines = found.splice(0);

    return lines.length === 0
      ? null
      : `the test logged Angular warnings:\n${lines.map((line) => `  ${line}`).join('\n')}`;
  };
};
