// Demo fixtures live here rather than in the component file. An interpolated template literal
// anywhere above an inline `template:` desynchronises the Angular VS Code extension's editor-side
// scanner, which then stops forwarding template completions to the language service — see the
// `ethlete/no-template-literal-before-inline-template` lint rule.

const FIRST = ['Luis', 'Ana', 'John', 'Kim', 'Femi', 'Ines', 'Jona', 'Lior', 'Mara', 'Dana'];
const LAST = ['Fernández', 'Martín', 'Doe', 'Sørensen', 'Adler', 'Berg', 'Castro', 'Diaz', 'Egede', 'Fuchs'];

// Many options → the select windows its rows (matches the real case: a scrollable listbox).
export const USERS = Array.from({ length: 500 }, (_, i) => {
  const first = FIRST[i % FIRST.length] ?? '';
  const last = LAST[Math.floor(i / FIRST.length) % LAST.length] ?? '';
  return {
    value: `user-${i + 1}`,
    label: `${first} ${last} ${i + 1}`,
    initials: `${first[0]}${last[0]}`,
  };
});
