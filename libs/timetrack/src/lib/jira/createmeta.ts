import { EMPTY, Observable, concatMap, expand, from, map, reduce, throwError, toArray } from 'rxjs';
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
};

type NamedTypeResource = CreateMetaTypeResource & { id: string; name: string };

const isNamed = (resource: CreateMetaTypeResource): resource is NamedTypeResource => !!resource.id && !!resource.name;

type CreateMetaPage = { total?: number };

type CreateMetaTypesPage = CreateMetaPage & {
  issueTypes?: CreateMetaTypeResource[];
  createMetaIssueType?: CreateMetaTypeResource[];
};

type CreateMetaFieldsPage = CreateMetaPage & {
  fields?: CreateMetaFieldResource[];
  results?: CreateMetaFieldResource[];
};

const JIRA_CREATEMETA_PAGE_SIZE = 200;

const CREATEMETA_MAX_PAGES = 10;

const createMetaPaged$ = <TPage extends CreateMetaPage, TItem>(options: {
  transport: TimetrackTransport;
  credentials: JiraCredentials;
  path: string;
  describe: string;
  itemsOf: (page: TPage) => TItem[] | undefined;
}): Observable<TItem[]> => {
  const page$ = (startAt: number) =>
    jiraRequest$<TPage>({
      transport: options.transport,
      credentials: options.credentials,
      path: options.path,
      describe: options.describe,
      query: { startAt, maxResults: JIRA_CREATEMETA_PAGE_SIZE },
    }).pipe(map((page) => ({ startAt, total: page.total, items: options.itemsOf(page) ?? [] })));

  return page$(0).pipe(
    expand((page, index) => {
      const next = page.startAt + page.items.length;
      const more =
        page.items.length > 0 &&
        (page.total === undefined ? page.items.length >= JIRA_CREATEMETA_PAGE_SIZE : next < page.total);

      if (!more) return EMPTY;
      if (index >= CREATEMETA_MAX_PAGES - 1) {
        return throwError(
          () => new Error(`Jira offered more than ${CREATEMETA_MAX_PAGES} pages of ${options.describe}.`),
        );
      }

      return page$(next);
    }),
    reduce((all: TItem[], page) => [...all, ...page.items], []),
  );
};

const requiredOf = (fields: readonly CreateMetaFieldResource[]) =>
  fields
    .filter((field) => field.required === true)
    .flatMap((field) => field.fieldId ?? field.key ?? [])
    .sort();

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
}): Observable<JiraCreatableType[]> => {
  const base = `/rest/api/3/issue/createmeta/${encodeURIComponent(options.projectKey)}/issuetypes`;

  return createMetaPaged$<CreateMetaTypesPage, CreateMetaTypeResource>({
    transport: options.transport,
    credentials: options.credentials,
    path: base,
    describe: `what may be created in ${options.projectKey}`,
    itemsOf: (page) => page.issueTypes ?? page.createMetaIssueType,
  }).pipe(
    concatMap((resources) => from(resources.filter(isNamed))),
    concatMap((resource) =>
      createMetaPaged$<CreateMetaFieldsPage, CreateMetaFieldResource>({
        transport: options.transport,
        credentials: options.credentials,
        path: `${base}/${encodeURIComponent(resource.id)}`,
        describe: `the fields a ${resource.name} in ${options.projectKey} needs`,
        itemsOf: (page) => page.fields ?? page.results,
      }).pipe(
        map((fields): JiraCreatableType => ({
          id: resource.id,
          name: resource.name,
          subtask: resource.subtask ?? false,
          hierarchyLevel: resource.hierarchyLevel ?? 0,
          requiredFieldIds: requiredOf(fields),
        })),
      ),
    ),
    toArray(),
  );
};

/** Whether the account may create this type here, matched by name the way settings name it. */
export const mayCreateType = (options: { typeName: string; types: readonly JiraCreatableType[] }) =>
  options.types.some((type) => type.name.toLowerCase() === options.typeName.trim().toLowerCase());

/** The names settings offer that the account may actually create, in the order settings hold them. */
export const creatableTypeNames = (options: { typeNames: readonly string[]; types: readonly JiraCreatableType[] }) =>
  options.typeNames.filter((typeName) => mayCreateType({ typeName, types: options.types }));
