import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const componentsDocs = join(__dirname, '../../../../apps/docs/components');
const skill = readFileSync(join(__dirname, '../../content/skills/sdk-docs/SKILL.md'), 'utf8');

describe('sdk-docs skill', () => {
  it('lists every component domain the docs site has', () => {
    const listBlock = skill.slice(skill.indexOf('Component domains under'), skill.indexOf('**Check this list'));
    const listed = [...listBlock.matchAll(/`([a-z0-9-]+)`/g)].map((match) => match[1]).sort();
    const pages = readdirSync(componentsDocs)
      .filter((file) => file.endsWith('.md') && file !== 'index.md')
      .map((file) => file.slice(0, -'.md'.length))
      .sort();

    expect(listed).toEqual(pages);
  });
});
