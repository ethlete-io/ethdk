import { Observable, map } from 'rxjs';
import { TimetrackTransport } from '../transport/ports';
import { TempoCredentials, tempoPaged$ } from './client';

/**
 * The attribute types Tempo v4 reports. `ACCOUNT` and `DYNAMIC_DROPDOWN` resolve their options from
 * elsewhere in the instance, so their values cannot be enumerated from this endpoint alone.
 */
export type TempoWorkAttributeType =
  'ACCOUNT' | 'CHECKBOX' | 'INPUT_TEXT' | 'INPUT_NUMBER' | 'STATIC_LIST' | 'DYNAMIC_DROPDOWN';

export type TempoWorkAttribute = {
  key: string;
  name: string;
  type: TempoWorkAttributeType;
  required: boolean;
  /** The selectable values, for a `STATIC_LIST`. Empty for every other type. */
  values: string[];
};

type TempoWorkAttributeResource = {
  key?: string;
  name?: string;
  type?: string;
  required?: boolean;
  values?: unknown[];
};

const ATTRIBUTE_TYPES: TempoWorkAttributeType[] = [
  'ACCOUNT',
  'CHECKBOX',
  'INPUT_TEXT',
  'INPUT_NUMBER',
  'STATIC_LIST',
  'DYNAMIC_DROPDOWN',
];

const toAttribute = (resource: TempoWorkAttributeResource): TempoWorkAttribute | undefined => {
  const type = ATTRIBUTE_TYPES.find((candidate) => candidate === resource.type);

  if (!resource.key || !type) return undefined;

  return {
    key: resource.key,
    name: resource.name ?? resource.key,
    type,
    required: resource.required === true,
    values: (resource.values ?? []).filter((value): value is string => typeof value === 'string'),
  };
};

/**
 * Reads the instance's work-attribute schema. Every Tempo instance configures its own — a billable
 * flag, a work category, an Account — and some of them are required on every worklog, so the review
 * UI has to be built from this rather than from an assumed shape.
 *
 * An attribute of a type this version does not model is dropped: a required attribute the app cannot
 * render is surfaced by {@link missingRequiredAttributes} at sync time, which is where it can be
 * reported, rather than silently written with a wrong value.
 */
export const fetchTempoWorkAttributes$ = (options: {
  transport: TimetrackTransport;
  credentials: TempoCredentials;
}): Observable<TempoWorkAttribute[]> =>
  tempoPaged$<TempoWorkAttributeResource>({
    transport: options.transport,
    credentials: options.credentials,
    path: '/work-attributes',
    describe: 'the work-attribute schema',
  }).pipe(map((resources) => resources.flatMap((resource) => toAttribute(resource) ?? [])));

/**
 * The required attributes a set of values does not answer. A worklog must never be sent with a
 * guessed value for one of these — the sync stops and the reviewer supplies it.
 */
export const missingRequiredAttributes = (options: {
  attributes: TempoWorkAttribute[];
  values: Record<string, string | number | boolean | undefined>;
}): TempoWorkAttribute[] =>
  options.attributes.filter((attribute) => {
    if (!attribute.required) return false;

    const value = options.values[attribute.key];

    return value === undefined || value === '';
  });

/**
 * Whether a given attribute can hold this app's worklog id: a free-text attribute the instance does
 * not require anyone else to fill in. When no such attribute exists the id has to go into the
 * worklog description instead, which is why the caller decides rather than this module.
 */
export const canHoldWorklogMarker = (attribute: TempoWorkAttribute) =>
  attribute.type === 'INPUT_TEXT' && !attribute.required;

/** The attribute the app should store its worklog id in, if the instance offers a usable one. */
export const findMarkerAttribute = (options: { attributes: TempoWorkAttribute[]; preferredKey?: string }) => {
  const usable = options.attributes.filter(canHoldWorklogMarker);

  return usable.find((attribute) => attribute.key === options.preferredKey) ?? usable[0];
};
