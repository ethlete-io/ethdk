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

const makePerson = (index: number): Person => {
  const name = NAMES[index % NAMES.length] ?? 'Person';

  return {
    id: index + 1,
    name: `${name} ${Math.floor(index / NAMES.length) + 1}`,
    email: `${name.toLowerCase().replace(/[^a-z]/g, '.')}@example.com`,
    role: ROLES[index % ROLES.length] ?? 'Viewer',
    joinedAt: `2024-${String((index % 12) + 1).padStart(2, '0')}-15`,
  };
};

export const PEOPLE: Person[] = Array.from({ length: 5 }, (_, index) => makePerson(index));

export type Project = {
  id: number;
  name: string;
  status: 'Active' | 'Paused' | 'Done';
  hours: number;
};

const PROJECT_NAMES = ['Atlas', 'Beacon', 'Cascade', 'Delta', 'Ember'];
const PROJECT_STATUSES: Project['status'][] = ['Active', 'Paused', 'Done'];

const makeProjects = (personId: number): Project[] =>
  Array.from({ length: (personId % 3) + 2 }, (_, index) => {
    const offset = personId + index;

    return {
      id: personId * 100 + index,
      name: PROJECT_NAMES[offset % PROJECT_NAMES.length] ?? 'Project',
      status: PROJECT_STATUSES[offset % PROJECT_STATUSES.length] ?? 'Active',
      hours: 4 + (offset % 5) * 8,
    };
  });

export const PROJECTS_BY_PERSON = new Map<number, Project[]>(
  PEOPLE.map((person) => [person.id, makeProjects(person.id)]),
);
