const MISSING_PACKAGE = /Cannot find package '([^']+)'/;

/** Turns a failed Angular import into a message that names the missing package, or returns null for any other error. */
export const missingPackageMessage = (error: unknown, checkout: string): string | null => {
  const text = error instanceof Error ? error.message : String(error);
  const name = MISSING_PACKAGE.exec(text)?.[1];

  if (!name || !name.startsWith('@angular/')) return null;

  return `ng() needs ${name} in ${checkout}; install it as a dev dependency.`;
};
