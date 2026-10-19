import { ApiDefinition } from './definition';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isText = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '';

/** Throws an error naming the file, the API and the path of the first field of `ready` and `doctor` that has the wrong shape. */
export const validateApiDefinition = ({
  fileName,
  name,
  api,
}: {
  fileName: string;
  name: string;
  api: ApiDefinition;
}) => {
  const fail = (path: string, problem: string): never => {
    throw new Error(`${fileName}: ${name}${path} ${problem}`);
  };

  const definition: Record<string, unknown> = isRecord(api) ? api : {};
  const { checks, profiles, migrationsDir } = definition;
  const services = Array.isArray(definition['services']) ? definition['services'] : [];

  if (migrationsDir !== undefined && !isText(migrationsDir)) fail('.migrationsDir', 'must be a non-empty path');

  if (checks !== undefined) {
    if (!Array.isArray(checks)) fail('.checks', 'must be a list');

    const names = new Set<string>();

    (checks as unknown[]).forEach((entry, index) => {
      const path = `.checks[${index}]`;

      if (!isRecord(entry)) return fail(path, 'must be an object');

      if (!isText(entry['name'])) fail(`${path}.name`, 'must be a non-empty string');

      if (names.has(entry['name'] as string)) fail(`${path}.name`, `"${entry['name']}" is declared twice`);

      names.add(entry['name'] as string);

      if (!isText(entry['check'])) fail(`${path}.check`, 'must be a shell line');

      if (entry['fix'] !== undefined && !isText(entry['fix'])) fail(`${path}.fix`, 'must be a shell line');

      if (entry['host'] !== undefined && typeof entry['host'] !== 'boolean') fail(`${path}.host`, 'must be a boolean');

      if (entry['service'] !== undefined && !services.includes(entry['service'])) {
        fail(`${path}.service`, `must be one of services: ${services.join(', ')}`);
      }
    });
  }

  if (profiles !== undefined) {
    if (!isRecord(profiles)) fail('.profiles', 'must be an object');

    for (const [profileName, profile] of Object.entries(profiles as Record<string, unknown>)) {
      const path = `.profiles.${profileName}`;

      if (!isRecord(profile)) return fail(path, 'must be an object');

      const { seeds, health, snapshot } = profile;

      if (!Array.isArray(seeds) || seeds.length === 0 || !seeds.every(isText)) {
        fail(`${path}.seeds`, 'must be a non-empty list of seed names');
      }

      if (health !== undefined) {
        if (!isRecord(health)) return fail(`${path}.health`, 'must be an object');

        if (!isText(health['url'])) fail(`${path}.health.url`, 'must be a string');

        if (health['expect'] !== undefined && !Number.isInteger(health['expect'])) {
          fail(`${path}.health.expect`, 'must be an integer');
        }
      }

      if (snapshot !== undefined) {
        if (!isRecord(snapshot)) return fail(`${path}.snapshot`, 'must be an object');

        if (!isText(snapshot['service'])) fail(`${path}.snapshot.service`, 'must be a service name');

        if (
          !Array.isArray(snapshot['databases']) ||
          snapshot['databases'].length === 0 ||
          !snapshot['databases'].every(isText)
        ) {
          fail(`${path}.snapshot.databases`, 'must be a non-empty list of database names');
        }

        if (!isText(snapshot['save'])) fail(`${path}.snapshot.save`, 'must be a shell line');

        if (!isText(snapshot['restore'])) fail(`${path}.snapshot.restore`, 'must be a shell line');
      }
    }
  }
};
