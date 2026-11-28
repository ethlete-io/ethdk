export const summaryLines = (results) => {
  const lines = ['Release smoke summary'];
  for (const { name, failures = [], notes = [], warnings = [] } of results) {
    lines.push(`${failures.length ? '✖' : warnings.length ? '⚠' : '✔'} ${name}`);
    for (const warning of warnings) lines.push(`  ${warning}`);
    for (const note of notes) lines.push(`    ${note}`);
    for (const failure of failures) lines.push(`  ✖ ${failure}`);
  }
  const failed = results.filter((result) => result.failures?.length);
  lines.push(failed.length ? `FAIL: ${failed.length} of ${results.length} app(s)` : `PASS: ${results.length} app(s)`);
  return lines;
};
