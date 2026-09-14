import { Observable, map } from 'rxjs';
import { TimetrackTransport } from '../transport/ports';
import { JiraCredentials, jiraRequest$ } from './client';

/** One issue type the account may create in a project, with the fields Jira will insist on. */
export type JiraCreatableType = {
  id: string;
  name: string;
  subtask: boolean;
  hierarchyLevel: number;
  /** The field ids a create must carry, `summary` among them. Anything else has to be answered. */
  requiredFieldIds: string[];
};

type CreateMetaFieldResource = { fieldId?: string; key?: string; required?: boolean };

type CreateMetaTypeResource = {
  id?: string;
  name?: string;
  subtask?: boolean;
  hierarchyLevel?: number;
  fields?: Record<string, CreateMetaFieldResource>;
};

type CreateMetaResource = { projects?: { issuetypes?: CreateMetaTypeResource[] }[] };

const requiredOf = (fields: Record<string, CreateMetaFieldResource> | undefined) =>
  Object.entries(fields ?? {})
    .filter(([, field]) => field.required === true)
    .map(([key, field]) => field.fieldId ?? field.key ?? key)
    .sort();

const toCreatableType = (resource: CreateMetaTypeResource): JiraCreatableType | undefined =>
  resource.id && resource.name
    ? {
        id: resource.id,
        name: resource.name,
        subtask: resource.subtask ?? false,
        hierarchyLevel: resource.hierarchyLevel ?? 0,
        requiredFieldIds: requiredOf(resource.fields),
      }
    : undefined;

/**
 * The issue types **this account may create in this project**, with the fields each one requires.
 *
 * It is the only thing that can answer whether a create is even permitted. Every other read reports
 * what the instance defines, which is not the same question: a type the project's scheme holds and
 * the account may not create is a button that fails after the user has written a summary.
 *
 * Jira says what it permits and never what the team agreed. An empty answer for a level is therefore
 * a hard no, while a type in the answer is only permission — whether the team wants the app to file
 * one is a separate, per-project decision that lives in settings.
 */
export const fetchJiraCreatableTypes$ = (options: {
  transport: TimetrackTransport;
  credentials: JiraCredentials;
  projectKey: string;
}): Observable<JiraCreatableType[]> =>
  jiraRequest$<CreateMetaResource>({
    transport: options.transport,
    credentials: options.credentials,
    path: '/rest/api/3/issue/createmeta',
    describe: `what may be created in ${options.projectKey}`,
    query: { projectKeys: options.projectKey, expand: 'projects.issuetypes.fields' },
  }).pipe(
    map((resource) =>
      (resource.projects ?? []).flatMap((project) =>
        (project.issuetypes ?? []).flatMap((issueType) => toCreatableType(issueType) ?? []),
      ),
    ),
  );

/** Whether the account may create this type here, matched by name the way settings name it. */
export const mayCreateType = (options: { typeName: string; types: readonly JiraCreatableType[] }) =>
  options.types.some((type) => type.name.toLowerCase() === options.typeName.trim().toLowerCase());

/** The names settings offer that the account may actually create, in the order settings hold them. */
export const creatableTypeNames = (options: { typeNames: readonly string[]; types: readonly JiraCreatableType[] }) =>
  options.typeNames.filter((typeName) => mayCreateType({ typeName, types: options.types }));
