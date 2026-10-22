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

export const PEOPLE: Person[] = Array.from({ length: 12 }, (_, index) => makePerson(index));
