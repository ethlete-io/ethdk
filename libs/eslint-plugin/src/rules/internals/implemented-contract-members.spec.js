// @ts-check
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { getImplementedContractMemberNames } = require('./implemented-contract-members');

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'implemented-contract-members-'));
const componentPath = path.join(fixtureRoot, 'fixture.component.ts');
const contractPath = path.join(fixtureRoot, 'fixture.contract.ts');
const componentText = "import { PublicApi } from './fixture.contract';\nclass C implements PublicApi {}";

/**
 * @param {string} name
 */
const implementing = (name) => ({ implements: [{ expression: { type: 'Identifier', name } }] });

const context = /** @type {any} */ ({ filename: componentPath, sourceCode: { text: componentText } });

/**
 * @param {string} member
 * @param {number} mtimeSeconds
 */
const writeContract = (member, mtimeSeconds) => {
  fs.writeFileSync(contractPath, `export type PublicApi = { ${member}(): void };`, 'utf8');
  fs.utimesSync(contractPath, mtimeSeconds, mtimeSeconds);
};

describe('getImplementedContractMemberNames', () => {
  it('sees a contract file that changed after it was cached', () => {
    writeContract('activate', 1_000_000);
    expect([...getImplementedContractMemberNames({ classNode: implementing('PublicApi'), context })]).toEqual([
      'activate',
    ]);

    writeContract('deactivate', 2_000_000);
    expect([...getImplementedContractMemberNames({ classNode: implementing('PublicApi'), context })]).toEqual([
      'deactivate',
    ]);
  });

  it('does not parse the current file for a class without implements', () => {
    const throwingContext = /** @type {any} */ ({
      filename: componentPath,
      sourceCode: {
        get text() {
          throw new Error('source text read');
        },
      },
    });

    expect(getImplementedContractMemberNames({ classNode: {}, context: throwingContext }).size).toBe(0);
    expect(getImplementedContractMemberNames({ classNode: { implements: [] }, context: throwingContext }).size).toBe(0);
  });
});
