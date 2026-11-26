import { migrateColumnVisibilityHost } from './column-visibility-host.js';
import { dedupeComponentsImports, migrateOverlayResult, renameCommandPalette } from './overlay-result.js';
import { applyEdits, Finding, importsEthleteComponents, maskSource } from './source-scan.js';

export type FileResult = { content: string; changed: boolean; findings: Finding[] };

export const isOverlayAndColumnCandidate = (filePath: string) =>
  /\.(?:ts|tsx|mts|cts)$/.test(filePath) && !filePath.endsWith('.d.ts');

export const migrateOverlayAndColumnApiInFile = (source: string): FileResult => {
  if (!importsEthleteComponents(source)) return { content: source, changed: false, findings: [] };

  const masked = maskSource(source);
  const overlay = migrateOverlayResult(source, masked);
  const columns = migrateColumnVisibilityHost(source, masked);
  const edits = [...overlay.edits, ...columns.edits, ...renameCommandPalette(masked)];
  const findings = [...overlay.findings, ...columns.findings].sort((a, b) => a.line - b.line);

  if (edits.length === 0) return { content: source, changed: false, findings };

  const content = dedupeComponentsImports(applyEdits(source, edits));

  return { content, changed: content !== source, findings };
};
