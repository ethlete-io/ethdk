import { describe, expect, it } from 'vitest';
import { CheckoutManifests, checkoutDependenciesOf } from './dependencies';

const SDK = '/home/you/dev/shared-sdk';
const APP_A = '/home/you/dev/app-a';
const APP_B = '/home/you/dev/app-b';

const pkg = (path: string, manifest: object) => ({ path, text: JSON.stringify(manifest) });

const SDK_MANIFESTS: CheckoutManifests = {
  repo: SDK,
  files: [
    pkg('package.json', { name: '@shared/source', devDependencies: { typescript: '5.9.0' } }),
    pkg('libs/core/package.json', { name: '@shared/core' }),
    pkg('libs/ui/package.json', { name: '@shared/ui', dependencies: { '@shared/core': 'workspace:*' } }),
  ],
};

describe('checkoutDependenciesOf', () => {
  it('reads a registry dependency on a package another checkout declares', () => {
    expect(
      checkoutDependenciesOf([
        SDK_MANIFESTS,
        { repo: APP_A, files: [pkg('package.json', { name: 'app-a', dependencies: { '@shared/ui': '1.0.0' } })] },
      ]),
    ).toEqual({ [APP_A]: [SDK] });
  });

  it('reads the dependencies of a nested workspace package', () => {
    expect(
      checkoutDependenciesOf([
        SDK_MANIFESTS,
        {
          repo: APP_A,
          files: [
            pkg('package.json', { name: '@a/source', workspaces: ['apps/*'] }),
            pkg('apps/web/package.json', { name: '@a/web', peerDependencies: { '@shared/core': '^1' } }),
          ],
        },
      ]),
    ).toEqual({ [APP_A]: [SDK] });
  });

  it('reads file:, link: and portal: specs relative to the package that holds them', () => {
    expect(
      checkoutDependenciesOf([
        SDK_MANIFESTS,
        { repo: APP_B, files: [pkg('package.json', { name: 'b' })] },
        {
          repo: APP_A,
          files: [
            pkg('apps/web/package.json', {
              dependencies: { core: 'file:../../../shared-sdk/libs/core', other: 'portal:../../../app-b' },
            }),
          ],
        },
      ]),
    ).toEqual({ [APP_A]: [APP_B, SDK] });
  });

  it('reads a tsconfig path alias into a sibling checkout, comments and trailing commas included', () => {
    const tsconfig = `{
      // aliases into the sibling checkout
      "compilerOptions": {
        "baseUrl": ".",
        "paths": { "@shared/core": ["../shared-sdk/libs/core/src/index.ts"], "@app/*": ["src/*"], },
      },
    }`;

    expect(
      checkoutDependenciesOf([
        { repo: SDK, files: [pkg('package.json', { name: '@shared/source' })] },
        { repo: APP_A, files: [{ path: 'tsconfig.base.json', text: tsconfig }] },
      ]),
    ).toEqual({ [APP_A]: [SDK] });
  });

  it('never makes two clones of one repository use each other', () => {
    const clone = { ...SDK_MANIFESTS, repo: '/home/you/dev/shared-sdk-hotfix' };

    expect(checkoutDependenciesOf([SDK_MANIFESTS, clone])).toEqual({});
  });

  it('reads a manifest that does not parse as naming nothing', () => {
    expect(
      checkoutDependenciesOf([SDK_MANIFESTS, { repo: APP_A, files: [{ path: 'package.json', text: '{ "name": ' }] }]),
    ).toEqual({});
  });
});
