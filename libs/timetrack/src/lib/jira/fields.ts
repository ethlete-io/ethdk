import { Observable, map } from 'rxjs';
import { TimetrackTransport } from '../transport/ports';
import { JiraCredentials, jiraRequest$ } from './client';

/** One field the instance defines, as the REST API names it. */
export type JiraField = {
  /** What a write goes to — `summary`, or `customfield_10057`. */
  id: string;
  name: string;
  custom: boolean;
  /** The schema type, such as `string`. Absent for a field the instance reports without one. */
  type?: string;
  /** The custom field type, such as `com.atlassian.jira.plugin.system.customfieldtypes:textarea`. */
  customType?: string;
};

/** The schema types a branch subject can be written to. Anything else yields an object, not a string. */
export const JIRA_TEXT_FIELD_TYPES: readonly string[] = ['string', 'any'];

const isRichText = (field: JiraField) => field.customType?.endsWith(':textarea') ?? false;

type JiraFieldResource = {
  id?: string;
  name?: string;
  custom?: boolean;
  schema?: { type?: string; custom?: string };
};

const toField = (resource: JiraFieldResource): JiraField[] =>
  resource.id
    ? [
        {
          id: resource.id,
          name: resource.name ?? resource.id,
          custom: resource.custom ?? false,
          type: resource.schema?.type,
          customType: resource.schema?.custom,
        },
      ]
    : [];

/** Every field the instance defines, with the name a person picks it by. */
export const fetchJiraFields$ = (options: {
  transport: TimetrackTransport;
  credentials: JiraCredentials;
}): Observable<JiraField[]> =>
  jiraRequest$<JiraFieldResource[]>({
    transport: options.transport,
    credentials: options.credentials,
    path: '/rest/api/3/field',
    describe: 'the instance fields',
  }).pipe(map((resources) => resources.flatMap(toField)));

/**
 * The fields a branch subject could be written to: the instance's own custom text fields, by name.
 *
 * Only custom ones, because a built-in field is never the answer — writing a branch subject into
 * `summary` or `description` would overwrite what the ticket says.
 */
export const jiraSubjectFieldCandidates = (fields: readonly JiraField[]) =>
  fields
    .filter(
      (field) => field.custom && !isRichText(field) && (!field.type || JIRA_TEXT_FIELD_TYPES.includes(field.type)),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
