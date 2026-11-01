/** One file a push changes, as `git diff --name-status --no-renames` prints it, relative to the checkout. */
export type PrepushChange = { status: 'A' | 'M' | 'D'; file: string };

/** The changes of `git diff --name-status --no-renames` output; a type change counts as a modification. */
export const parseNameStatus = (output: string): PrepushChange[] =>
  output.split('\n').flatMap((line) => {
    const [status, file] = line.split('\t');

    if (!status || !file) return [];

    return [{ status: status === 'A' || status === 'D' ? status : 'M', file }];
  });
