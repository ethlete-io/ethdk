import { Tree } from '@nx/devkit';

export const TOOLKIT_MIGRATION_REPORT_PATH = 'query-toolkit-migration-tasks.md';

/** Stable task ids. A task keeps its id across runs, so a follow-up list can be diffed and ticked off. */
export const TOOLKIT_TASK = {
  MIXED_ACTIONS: 'NTK-MIXED-ACTIONS',
  CUSTOM_EFFECT: 'NTK-CUSTOM-EFFECT',
  CUSTOM_REDUCER: 'NTK-CUSTOM-REDUCER',
  ACTION_WITHOUT_EFFECT: 'NTK-ACTION-WITHOUT-EFFECT',
  SERVICE_UNSUPPORTED: 'NTK-SERVICE-UNSUPPORTED',
  SERVICE_API_BASE: 'NTK-SERVICE-API-BASE',
  SERVICE_HEADERS: 'NTK-SERVICE-HEADERS',
  SERVICE_CACHE_EXPIRY: 'NTK-SERVICE-CACHE-EXPIRY',
  ARGS_UNRESOLVED: 'NTK-ARGS-UNRESOLVED',
  ARGS_INHERITED: 'NTK-ARGS-INHERITED',
  FACADE_STORE_MEMBER: 'NTK-FACADE-STORE-MEMBER',
  FACADE_WITHOUT_HTTP: 'NTK-FACADE-WITHOUT-HTTP',
  DUPLICATE_ROUTE_MISMATCH: 'NTK-DUPLICATE-ROUTE-MISMATCH',
  STORE_FILE_KEPT: 'NTK-STORE-FILE-KEPT',
  COMMENTED_FEATURE: 'NTK-COMMENTED-FEATURE',
} as const;

export type ToolkitTaskId = (typeof TOOLKIT_TASK)[keyof typeof TOOLKIT_TASK];

export type ToolkitTaskLocation = {
  filePath: string;
  line?: number;
};

export type ToolkitTaskInput = {
  id: string;
  summary: string;
  locations: ToolkitTaskLocation[];
};

type ToolkitTaskDefinition = {
  title: string;
  action: string;
};

const TASK_DEFINITIONS: Record<ToolkitTaskId, ToolkitTaskDefinition> = {
  [TOOLKIT_TASK.MIXED_ACTIONS]: {
    title: 'Feature has actions besides HTTP action groups',
    action:
      'Move the plain NgRx actions (and the facade members that dispatch them) out of the feature, then re-run the generator. The feature was left on the toolkit.',
  },
  [TOOLKIT_TASK.CUSTOM_EFFECT]: {
    title: 'Feature has effects besides onAction* calls',
    action:
      'Move the custom effect out of the feature (or rewrite it on the v3 creator), then re-run the generator. The feature was left on the toolkit.',
  },
  [TOOLKIT_TASK.CUSTOM_REDUCER]: {
    title: 'Feature reducer holds extra state',
    action:
      'The reducer keeps state besides the toolkit slice. Move that state out of the feature, then re-run the generator. The feature was left on the toolkit.',
  },
  [TOOLKIT_TASK.ACTION_WITHOUT_EFFECT]: {
    title: 'Action group has no effect',
    action:
      'No effect sends this action group to the service, so the generator cannot tell which request it makes. Wire it up or delete it, then re-run. The feature was left on the toolkit.',
  },
  [TOOLKIT_TASK.SERVICE_UNSUPPORTED]: {
    title: 'Service method the generator cannot read',
    action:
      'Rewrite the method to a plain `return this.get|post|put|patch|delete({ apiRoute, httpOpts: args, responseType })`, or write the v3 creator by hand. The feature was left on the toolkit.',
  },
  [TOOLKIT_TASK.SERVICE_API_BASE]: {
    title: 'Service talks to another API base',
    action:
      'The service does not use the API base of the v3 client. Point a creator of the matching v3 client at it by hand. The feature was left on the toolkit.',
  },
  [TOOLKIT_TASK.SERVICE_HEADERS]: {
    title: 'Service set request headers',
    action:
      'The service added headers the creator does not send. Pass them per call (`actionOptions.headers`) or add them to the client, then check the request.',
  },
  [TOOLKIT_TASK.SERVICE_CACHE_EXPIRY]: {
    title: 'Service cached responses for a fixed time',
    action:
      'The toolkit kept this response for `cacheExpiresIn` seconds; the v3 creator requests again on every call. Decide whether the screen needs a cache.',
  },
  [TOOLKIT_TASK.ARGS_UNRESOLVED]: {
    title: 'Args type the generator cannot read',
    action:
      'Declare the args as an interface or type literal with `queryParams` / `params` / `body` in the models file, then re-run. The feature was left on the toolkit.',
  },
  [TOOLKIT_TASK.ARGS_INHERITED]: {
    title: 'Args type extends another type',
    action:
      'Only the members declared on the args type itself were mapped to the creator. If the base type adds `queryParams`, `params` or `body`, add them to the creator type.',
  },
  [TOOLKIT_TASK.FACADE_STORE_MEMBER]: {
    title: 'Facade member uses the NgRx store',
    action:
      'Rewrite or remove the member (for example a `resetFeatureStore` dispatch), then re-run the generator. The feature was left on the toolkit.',
  },
  [TOOLKIT_TASK.FACADE_WITHOUT_HTTP]: {
    title: 'Toolkit facade without HTTP state',
    action:
      'The facade extends `FacadeBase` but has no action groups. Drop `FacadeBase` and the store wiring by hand once nothing reads its state.',
  },
  [TOOLKIT_TASK.DUPLICATE_ROUTE_MISMATCH]: {
    title: 'A v3 creator for the route already exists with other types',
    action: 'The generator wrote a second creator. Merge the two once the types agree, and keep one.',
  },
  [TOOLKIT_TASK.STORE_FILE_KEPT]: {
    title: 'Store files kept because code outside the feature uses them',
    action:
      'The facade now uses the v3 creators, but the listed code still imports the reducer, effects, selectors, service or action record. Rewrite it, then delete the store files and their registration.',
  },
  [TOOLKIT_TASK.COMMENTED_FEATURE]: {
    title: 'Commented-out toolkit feature',
    action: 'The feature only exists as comments. Delete the folder or restore it.',
  },
};

export type ToolkitTask = ToolkitTaskInput & ToolkitTaskDefinition;

/**
 * Collects the follow-up tasks of a toolkit migration run and writes them to
 * `query-toolkit-migration-tasks.md`. Tasks are grouped by their stable id.
 */
export class ToolkitMigrationReport {
  readonly tasks: ToolkitTask[] = [];

  private readonly definitions = new Map<string, ToolkitTaskDefinition>(Object.entries(TASK_DEFINITIONS));

  /** Registers a task id another migration phase records, so its title and action render in the report. */
  define(id: string, definition: ToolkitTaskDefinition) {
    this.definitions.set(id, definition);
  }

  add(input: ToolkitTaskInput) {
    const definition = this.definitions.get(input.id);

    if (!definition) {
      throw new Error(`Unknown toolkit migration task id "${input.id}".`);
    }

    const duplicate = this.tasks.some(
      (task) =>
        task.id === input.id &&
        task.summary === input.summary &&
        task.locations[0]?.filePath === input.locations[0]?.filePath,
    );

    if (!duplicate) {
      this.tasks.push({ ...definition, ...input });
    }
  }

  count(id: string) {
    return this.tasks.filter((task) => task.id === id).length;
  }

  printSummary() {
    if (this.tasks.length === 0) return;

    const ids = [...new Set(this.tasks.map((task) => task.id))];

    console.warn(`\n⚠️ Recorded ${this.tasks.length} follow-up task${this.tasks.length === 1 ? '' : 's'}:`);
    ids.forEach((id) => console.warn(` - ${id}: ${this.count(id)}`));
    console.warn(`\n📄 See ${TOOLKIT_MIGRATION_REPORT_PATH} for the list.`);
  }

  writeToTree(tree: Tree) {
    tree.write(TOOLKIT_MIGRATION_REPORT_PATH, renderToolkitReport(this.tasks));
  }
}

const renderLocation = (location: ToolkitTaskLocation) =>
  `${location.filePath}${location.line ? `:${location.line}` : ''}`;

export const renderToolkitReport = (tasks: readonly ToolkitTask[]) => {
  const header = [
    '# NgRx Toolkit Migration Follow-Up',
    '',
    'Generated by the `@ethlete/query:migrate-from-ngrx-toolkit` generator.',
    '',
    '## Instructions',
    '',
    '1. Re-read the listed files before changing anything.',
    '2. Tasks that say "left on the toolkit" can be re-run: fix the cause, then run the generator again.',
    '3. Remove a task only once the code and its tests confirm it is resolved.',
    '',
  ];

  if (tasks.length === 0) {
    return [...header, '## Tasks', '', 'No follow-up tasks were recorded.', ''].join('\n');
  }

  const ids = [...new Set(tasks.map((task) => task.id))];

  const sections = ids.flatMap((id) => {
    const group = tasks.filter((task) => task.id === id);
    const first = group[0]!;

    return [
      `### ${id} - ${first.title}`,
      '',
      `Action: ${first.action}`,
      '',
      ...group.map(
        (task) => `- [ ] ${task.summary} (${task.locations.map(renderLocation).join(', ') || 'no location'})`,
      ),
      '',
    ];
  });

  return [...header, '## Tasks', '', ...sections].join('\n');
};
