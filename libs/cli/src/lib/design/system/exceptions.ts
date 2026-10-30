import { existsSync, readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { partOwnerOf } from './inventory-approval';
import { partKeyOf, ResolvedProduct } from './resolve-product';
import { partHashOf } from './sketch/baseline';

export const EXCEPTIONS_FILE = 'exceptions.json';

export type ExceptionApproval = { by: string; at: string; hash: string };

/** An exception to one requirement of a part, keyed `<layer>/<name>.<control>.<requirement>`; only Studio sets `approval`. */
export type DesignException = { reason: string; requested: string; approval?: ExceptionApproval };

export type ExceptionState = 'approved' | 'pending' | 'reopened';

export type ListedException = { key: string; state: ExceptionState; reason: string; approval?: ExceptionApproval };

const KEY = /^([a-z0-9-]+\/[a-z0-9-]+)\.([^.\s]+)\.([^.\s]+)$/;

const exceptionsFileOf = (productDir: string) => resolve(productDir, EXCEPTIONS_FILE);

const isApproval = (value: unknown): value is ExceptionApproval => {
  if (!value || typeof value !== 'object') return false;

  const { by, at, hash } = value as Record<string, unknown>;

  return typeof by === 'string' && typeof at === 'string' && typeof hash === 'string';
};

const isException = (value: unknown): value is DesignException => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;

  const { reason, requested, approval } = value as Record<string, unknown>;

  return (
    typeof reason === 'string' && typeof requested === 'string' && (approval === undefined || isApproval(approval))
  );
};

/** The part key of an exception key, or why the key is not `<layer>/<name>.<control>.<requirement>`. */
export const exceptionPartOf = (key: string) =>
  KEY.exec(key)?.[1] ?? `"${key}" is not <layer>/<name>.<control>.<requirement>`;

export const readExceptions = (productDir: string): Record<string, DesignException> => {
  const file = exceptionsFileOf(productDir);

  if (!existsSync(file)) return {};

  try {
    const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));

    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? Object.fromEntries(
          Object.entries(parsed).filter((entry): entry is [string, DesignException] => isException(entry[1])),
        )
      : {};
  } catch {
    return {};
  }
};

const writeExceptions = (productDir: string, exceptions: Record<string, DesignException>) => {
  const sorted = Object.fromEntries(Object.entries(exceptions).sort(([a], [b]) => a.localeCompare(b)));

  writeFileSync(exceptionsFileOf(productDir), `${JSON.stringify(sorted, null, 2)}\n`);
};

const ownedPartOf = (options: { product: ResolvedProduct; key: string }) => {
  const part = exceptionPartOf(options.key);

  if (part.startsWith('"')) return part;

  const resolved = options.product.parts.find((candidate) => partKeyOf(candidate) === part);

  if (!resolved) return `product "${options.product.name}" has no part "${part}"`;

  const owner = partOwnerOf({ product: options.product, part: resolved });

  return { owner, hash: () => partHashOf({ product: owner, dir: dirname(resolved.file) }) };
};

/** Writes a pending exception, which still fails `design complete` until Studio approves it, or answers why not. */
export const requestException = (options: { product: ResolvedProduct; key: string; reason: string; at?: string }) => {
  const { product, key } = options;
  const reason = options.reason.trim();

  if (reason === '') return 'an exception needs a --reason';

  const owned = ownedPartOf({ product, key });

  if (typeof owned === 'string') return owned;

  const exception: DesignException = { reason, requested: options.at ?? new Date().toISOString() };

  writeExceptions(owned.owner.dir, { ...readExceptions(owned.owner.dir), [key]: exception });

  return exception;
};

/** Records the user's approval of a requested exception at the part's current hash, or answers why it is refused. */
export const approveException = (options: {
  product: ResolvedProduct;
  key: unknown;
  by: unknown;
  at?: string;
}): { status: number; error: string } | DesignException => {
  const { product, key, by } = options;

  if (typeof by !== 'string' || by.trim() === '') return { status: 400, error: 'by is required' };
  if (typeof key !== 'string' || key === '') return { status: 400, error: 'key is required' };

  const owned = ownedPartOf({ product, key });

  if (typeof owned === 'string') return { status: 422, error: owned };

  const exceptions = readExceptions(owned.owner.dir);
  const requested = exceptions[key];

  if (!requested) return { status: 404, error: `no exception "${key}" was requested` };

  const approved: DesignException = {
    ...requested,
    approval: { by: by.trim(), at: options.at ?? new Date().toISOString(), hash: owned.hash() },
  };

  writeExceptions(owned.owner.dir, { ...exceptions, [key]: approved });

  return approved;
};

const stateOf = (exception: DesignException, hash: string): ExceptionState =>
  !exception.approval ? 'pending' : exception.approval.hash === hash ? 'approved' : 'reopened';

/** Every exception of a product's own and base parts with its state at each part's current hash, for Studio. */
export const listExceptions = (product: ResolvedProduct): ListedException[] =>
  [product.dir, ...(product.base ? [product.base.dir] : [])].flatMap((dir) =>
    Object.entries(readExceptions(dir)).flatMap(([key, exception]) => {
      const owned = ownedPartOf({ product, key });

      return typeof owned === 'string' || owned.owner.dir !== dir
        ? []
        : [{ key, state: stateOf(exception, owned.hash()), reason: exception.reason, approval: exception.approval }];
    }),
  );

const NOTES: Record<Exclude<ExceptionState, 'approved'>, string> = {
  pending: 'its exception is pending - approve it in Studio',
  reopened: 'its approved exception reopened: the part changed - approve it again in Studio',
};

/**
 * Drops each gap an approved exception at `hash` covers, and marks the gaps of a pending or reopened one, which
 * still fail. `listed` holds every exception of the part, for the report.
 */
export const withExceptions = <T extends { target: string; detail: string }>(options: {
  part: string;
  gaps: T[];
  exceptions: Record<string, DesignException>;
  hash: string;
}) => {
  const { part, exceptions, hash } = options;
  const listed: ListedException[] = Object.entries(exceptions)
    .filter(([key]) => exceptionPartOf(key) === part)
    .map(([key, exception]) => ({
      key,
      state: stateOf(exception, hash),
      reason: exception.reason,
      approval: exception.approval,
    }));
  const byKey = new Map(listed.map((exception) => [exception.key, exception]));
  const gaps = options.gaps.flatMap((gap) => {
    const exception = byKey.get(gap.target);

    if (!exception) return [gap];
    if (exception.state === 'approved') return [];

    return [{ ...gap, detail: `${gap.detail} - ${NOTES[exception.state]} ("${exception.reason}")` }];
  });

  return { gaps, listed };
};

export const exceptionLineOf = ({ key, state, reason, approval }: ListedException) =>
  `EXCEPTION ${key} ${state}${approval ? ` (approved by ${approval.by} at ${approval.at})` : ''} - ${reason}`;
