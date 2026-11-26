import { readPackageMigrations } from './migration-manifest';
import { readMigrationRecord } from './migration-record';
import { declaredEthletePackages } from './packages';
import { PendingMigration, availableMigrations, orderAvailableMigrations } from './plan';

export type AvailableMigration = PendingMigration & {
  /** The installed version of the package. */
  installed: string;
};

/** The recommended and optional migrations of every installed `@ethlete/*` package that have not run yet. */
export const collectAvailableMigrations = (root: string) => {
  const { record, problems } = readMigrationRecord(root);
  const available: AvailableMigration[] = [];

  for (const declared of declaredEthletePackages({ root })) {
    const installed = declared.installedVersion;

    if (installed === undefined) continue;

    const packageMigrations = readPackageMigrations({ root, packageName: declared.name });

    problems.push(...packageMigrations.problems);
    available.push(
      ...availableMigrations({ packageMigrations, installed, record }).map((entry) => ({ ...entry, installed })),
    );
  }

  return { available: orderAvailableMigrations(available), problems };
};
