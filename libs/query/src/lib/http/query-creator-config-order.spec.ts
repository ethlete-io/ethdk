import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const here = dirname(fileURLToPath(import.meta.url));
const probeFile = join(here, '__config-order-probe.ts');

const probeSource = `
import { QueryCreator } from './query-creator';
import { withArgs } from './query-features';

type UserArgs = { response: { id: string }; pathParams: { id: string } };

export const probe = (getUser: QueryCreator<UserArgs>) => [
  getUser({ key: 'user' }, withArgs(() => ({ pathParams: { id: '1' } }))),
  getUser(withArgs(() => ({ pathParams: { id: '1' } })), { key: 'user' }),
];
`;

const typeErrorsOfProbe = () => {
  const configPath = join(here, '../../../tsconfig.spec.json');
  const parsed = ts.getParsedCommandLineOfConfigFile(
    configPath,
    { skipLibCheck: true, noEmit: true },
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
        throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
      },
    },
  );

  if (!parsed) throw new Error('tsconfig.spec.json could not be parsed');

  const host = ts.createCompilerHost(parsed.options);
  const readFile = host.readFile.bind(host);
  const fileExists = host.fileExists.bind(host);
  const getSourceFile = host.getSourceFile.bind(host);

  host.readFile = (fileName) => (fileName === probeFile ? probeSource : readFile(fileName));
  host.fileExists = (fileName) => fileName === probeFile || fileExists(fileName);
  host.getSourceFile = (fileName, languageVersion, ...rest) =>
    fileName === probeFile
      ? ts.createSourceFile(fileName, probeSource, languageVersion)
      : getSourceFile(fileName, languageVersion, ...rest);

  const program = ts.createProgram({ rootNames: [probeFile], options: parsed.options, host });
  const source = program.getSourceFile(probeFile);

  if (!source) throw new Error('probe file missing from the program');

  return program.getSemanticDiagnostics(source).map((diagnostic) => ({
    line: source.getLineAndCharacterOfPosition(diagnostic.start ?? 0).line,
    message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
  }));
};

describe('query creator config order', () => {
  it('names the config-first rule when a config follows the features', () => {
    const errors = typeErrorsOfProbe();
    const lateConfigLine = probeSource.split('\n').findIndex((line) => line.includes("), { key: 'user' })"));

    expect(errors).toHaveLength(1);
    expect(errors[0]?.line).toBe(lateConfigLine);
    expect(errors[0]?.message).toContain('The QueryConfig must come first, before the feature arguments');
  }, 60_000);
});
