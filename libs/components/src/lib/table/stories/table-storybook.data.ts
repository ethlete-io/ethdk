// Demo fixtures live here rather than in the component file. An interpolated template literal
// anywhere above an inline `template:` desynchronises the Angular VS Code extension's editor-side
// scanner, which then stops forwarding template completions to the language service - see the
// `ethlete/no-template-literal-before-inline-template` lint rule.

export type Person = {
  id: number;
  name: string;
  email: string;
  role: 'Admin' | 'Editor' | 'Viewer';
  joinedAt: string;
};

const NAMES = [
  'Ada Lovelace',
  'Alan Turing',
  'Grace Hopper',
  'Katherine Johnson',
  'Linus Torvalds',
  'Margaret Hamilton',
  'Dennis Ritchie',
  'Barbara Liskov',
  'Donald Knuth',
  'Radia Perlman',
];

export const ROLES: Person['role'][] = ['Admin', 'Editor', 'Viewer'];

const makePerson = (i: number): Person => {
  const name = NAMES[i % NAMES.length] ?? 'Person';

  return {
    id: i + 1,
    name: `${name} ${Math.floor(i / NAMES.length) + 1}`,
    email: `${name.toLowerCase().replace(/[^a-z]/g, '.')}@example.com`,
    role: ROLES[i % ROLES.length] ?? 'Viewer',
    joinedAt: `2024-${String((i % 12) + 1).padStart(2, '0')}-15`,
  };
};

export const PEOPLE: Person[] = Array.from({ length: 40 }, (_, i) => makePerson(i));

// A large set to exercise virtualization - only a window of these ever renders.
export const MANY_PEOPLE: Person[] = Array.from({ length: 2000 }, (_, i) => makePerson(i));

// Sub-table fixture: the projects a person works on, rendered by a nested table in the detail row.
export type Project = {
  id: number;
  name: string;
  status: 'Active' | 'Paused' | 'Done';
  hours: number;
};

const PROJECT_NAMES = ['Atlas', 'Beacon', 'Cascade', 'Delta', 'Ember'];
const PROJECT_STATUSES: Project['status'][] = ['Active', 'Paused', 'Done'];

const makeProjects = (personId: number): Project[] =>
  Array.from({ length: (personId % 3) + 2 }, (_, i) => {
    const offset = personId + i;

    return {
      id: personId * 100 + i,
      name: PROJECT_NAMES[offset % PROJECT_NAMES.length] ?? 'Project',
      status: PROJECT_STATUSES[offset % PROJECT_STATUSES.length] ?? 'Active',
      hours: 4 + (offset % 5) * 8,
    };
  });

// Built up front and looked up by person id, so the array a detail row hands its nested table keeps
// the same identity across change detection - a freshly built array every read would churn the
// sub-table's own derived state.
export const PROJECTS_BY_PERSON = new Map<number, Project[]>(
  PEOPLE.map((person) => [person.id, makeProjects(person.id)]),
);
