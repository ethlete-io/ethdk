import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { DesignConfig } from '../../design-config';
import { actionKeysOfMarkup, PartModuleLoader, partActionsOf, withPartLoader } from '../action-lost';
import { Problem } from '../problem';
import { partKeyOf, ResolvedProduct } from '../resolve-product';

export const CAPABILITY_PLACE_RULE = 'CAPABILITY-PLACE';

export const CAPABILITIES_FILE = 'capabilities.json';

export type CapabilityPlace = { part: string; action: string };

/** A user capability of a product and the design action that draws it; `missing` names the backlog entry of a known gap. */
export type Capability = {
  id: string;
  label: string;
  place: CapabilityPlace | null;
  confirmed?: boolean;
  missing?: string;
  why?: string;
};

export type CapabilityVerdict = { errors: Problem[]; warnings: Problem[] };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const isPlace = (value: unknown): value is CapabilityPlace | null =>
  value === null || (isRecord(value) && typeof value['part'] === 'string' && typeof value['action'] === 'string');

const isCapability = (value: unknown): value is Capability =>
  isRecord(value) &&
  typeof value['id'] === 'string' &&
  typeof value['label'] === 'string' &&
  'place' in value &&
  isPlace(value['place']) &&
  (value['missing'] === undefined || typeof value['missing'] === 'string');

/** The raw entries of a product's `capabilities.json`, null without the file, or the problem that makes it unreadable. */
export const readCapabilities = (dir: string): unknown[] | Problem | null => {
  const file = join(dir, CAPABILITIES_FILE);

  if (!existsSync(file)) return null;

  const problem = (message: string): Problem => ({ rule: CAPABILITY_PLACE_RULE, file, message });

  try {
    const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));

    return isRecord(parsed) && Array.isArray(parsed['capabilities'])
      ? parsed['capabilities']
      : problem(`${CAPABILITIES_FILE} needs a "capabilities" list`);
  } catch (error) {
    return problem(`${CAPABILITIES_FILE} is no JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
};

/**
 * Checks every capability against the action keys each part declares: one without a place, or with a place no part
 * declares, is an error; a known missing one is a warning, and an error once it has a place again.
 */
export const capabilityPlaceVerdictOf = (options: {
  file: string;
  capabilities: unknown[];
  declared: ReadonlyMap<string, readonly string[]>;
}): CapabilityVerdict => {
  const problem = (message: string): Problem => ({ rule: CAPABILITY_PLACE_RULE, file: options.file, message });
  const seen = new Set<string>();
  const errors: Problem[] = [];
  const warnings: Problem[] = [];

  options.capabilities.forEach((entry, index) => {
    if (!isCapability(entry)) {
      errors.push(problem(`entry ${index + 1}: needs an id, a label and a place that is {part, action} or null`));

      return;
    }

    if (seen.has(entry.id)) {
      errors.push(problem(`${entry.id}: listed twice`));

      return;
    }

    seen.add(entry.id);

    const name = `${entry.id} (${entry.label})`;
    const { place, missing } = entry;

    if (!place) {
      if (missing) warnings.push(problem(`${name}: no design action yet, known and tracked in ${missing}`));
      else errors.push(problem(`${name}: no design action draws it - give it a place {part, action}`));

      return;
    }

    if (missing)
      errors.push(problem(`${name}: has a place but is still marked missing (${missing}) - remove "missing"`));

    const actions = options.declared.get(place.part);

    if (!actions) errors.push(problem(`${name}: its place ${place.part} is no part of the product`));
    else if (!actions.includes(place.action))
      errors.push(
        problem(
          `${name}: ${place.part} declares no action "${place.action}" - its actions: ${actions.join(', ') || 'none'}`,
        ),
      );
  });

  return { errors, warnings };
};

const placedPartsOf = (capabilities: unknown[]) =>
  new Set(capabilities.flatMap((entry) => (isCapability(entry) && entry.place ? [entry.place.part] : [])));

const declaredOf = async (options: { load: PartModuleLoader; product: ResolvedProduct; parts: Set<string> }) => {
  const declared = new Map<string, string[]>();

  for (const part of options.product.parts) {
    const key = partKeyOf(part);

    if (!options.parts.has(key)) continue;

    const rendered = await partActionsOf({ load: options.load, product: options.product, part: key });
    const literal = actionKeysOfMarkup(part.source).filter((action) => !action.includes('${'));

    declared.set(
      key,
      [...new Set([...(typeof rendered === 'string' ? [] : rendered), ...literal])].sort((a, b) => a.localeCompare(b)),
    );
  }

  return declared;
};

/**
 * The CAPABILITY-PLACE verdict of a product's `capabilities.json`, against the actions its parts render outside a
 * browser plus the literal `data-et-action` values of their source; nothing for a product without the file.
 */
export const capabilityPlaceOf = async (options: {
  target: string;
  config: DesignConfig;
  product: ResolvedProduct;
  load?: PartModuleLoader;
}): Promise<CapabilityVerdict> => {
  const capabilities = readCapabilities(options.product.dir);

  if (!capabilities) return { errors: [], warnings: [] };

  if (!Array.isArray(capabilities)) return { errors: [capabilities], warnings: [] };

  const parts = placedPartsOf(capabilities);
  const read = (load: PartModuleLoader) => declaredOf({ load, product: options.product, parts });
  const declared =
    parts.size === 0 ? new Map() : options.load ? await read(options.load) : await withPartLoader(options, read);

  return capabilityPlaceVerdictOf({
    file: join(options.product.dir, CAPABILITIES_FILE),
    capabilities,
    declared,
  });
};
