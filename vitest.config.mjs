throw new Error(
  'vitest: the repo root runs no specs. Run vitest in the project dir (`cd libs/cli && npx vitest related --run <files>`), `node --test <spec>` for tools/**, or `npx vitest --config vitest.projects.ts` for every project.',
);
