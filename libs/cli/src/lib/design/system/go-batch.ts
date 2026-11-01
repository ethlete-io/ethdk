import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { acceptStepOf } from './accept-command';
import { DrawStates } from './accepted-pictures';
import { decisionOf } from './go-guard';
import { goStepOf } from './go-step';
import { DesignStep, runSteps, TomPrompt, tomConfirmRefusalOf } from './tom-confirm';

/** One entry of a go list: Tom's go or acceptance of a part, the decision that names it, and the commit it checks. */
export type GoListEntry = { part: string; product: string; action: 'go' | 'accept'; note: string; verify?: string };

const isEntry = (value: unknown): value is GoListEntry => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;

  const { part, product, action, note, verify } = value as Record<string, unknown>;

  return (
    typeof part === 'string' &&
    typeof product === 'string' &&
    (action === 'go' || action === 'accept') &&
    typeof note === 'string' &&
    (verify === undefined || typeof verify === 'string')
  );
};

const readGoList = (file: string): GoListEntry[] | string => {
  try {
    const parsed: unknown = JSON.parse(readFileSync(resolve(file), 'utf8'));

    if (!Array.isArray(parsed) || parsed.length === 0) return `${file}: a go list is a non-empty JSON array`;

    const wrong = parsed.findIndex((entry) => !isEntry(entry));

    return wrong === -1
      ? (parsed as GoListEntry[])
      : `${file} entry ${wrong + 1}: needs part, product, action "go" or "accept", note "Impl Qnn" and an optional verify sha`;
  } catch (error) {
    return `${file}: ${error instanceof Error ? error.message : String(error)}`;
  }
};

const isCommit = (target: string, sha: string) => {
  try {
    execFileSync('git', ['rev-parse', '--verify', '--quiet', `${sha}^{commit}`], { cwd: target, stdio: 'ignore' });

    return true;
  } catch {
    return false;
  }
};

const stepOf = (options: { target: string; entry: GoListEntry; draw?: DrawStates }): DesignStep | string => {
  const { target, entry } = options;
  const note = entry.note.trim();

  if (entry.verify !== undefined && !isCommit(target, entry.verify)) return `verify ${entry.verify} is no commit`;

  if (entry.action === 'accept') {
    const decided = decisionOf({ root: target, note });

    if ('refusal' in decided) return `accept ${decided.refusal}`;
  }

  const step = (entry.action === 'go' ? goStepOf : acceptStepOf)({
    target,
    product: entry.product,
    part: entry.part,
    by: 'tom',
    note,
    draw: options.draw,
  });

  return typeof step === 'string' || entry.verify === undefined
    ? step
    : { ...step, line: `${step.line} - verify ${entry.verify}` };
};

/** `et design go --batch <file>` shows every entry of a go list and records them all as Tom after one yes. */
export const goBatch = async (options: {
  target: string;
  file: string;
  invocation: string;
  draw?: DrawStates;
  prompt: TomPrompt;
}) => {
  const entries = readGoList(options.file);

  if (typeof entries === 'string') {
    console.error(entries);

    return 1;
  }

  const steps = entries.map((entry) => stepOf({ target: options.target, entry, draw: options.draw }));
  const refusals = steps.flatMap((step, index) =>
    typeof step === 'string' ? [`${entries[index]?.action} ${entries[index]?.part}: ${step}`] : [],
  );

  if (refusals.length > 0) {
    console.error(`${refusals.join('\n')}\nnothing recorded - fix the go list`);

    return 1;
  }

  const ready = steps.filter((step): step is DesignStep => typeof step !== 'string');
  const refusal = await tomConfirmRefusalOf({
    steps: ready,
    invocation: options.invocation,
    prompt: options.prompt,
    batchFile: options.file,
  });

  if (refusal) {
    console.error(refusal);

    return 1;
  }

  return runSteps(ready);
};
