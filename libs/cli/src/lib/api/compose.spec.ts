import { describe, expect, it } from 'vitest';
import { composeBinary, composeToolNames, engineEnv, resolveComposeTool } from './compose';

describe('composeBinary', () => {
  it('drops the flags that are not part of the binary', () => {
    expect(composeBinary(['podman-compose', '--podman-run-args=--security-opt label=disable'])).toEqual([
      'podman-compose',
    ]);
  });

  it('keeps a multi-word binary', () => {
    expect(composeBinary(['docker', 'compose'])).toEqual(['docker', 'compose']);
  });
});

describe('composeToolNames', () => {
  it('names every candidate without its flags', () => {
    expect(composeToolNames()).toEqual(['docker compose', 'container compose', 'podman-compose', 'podman compose']);
  });
});

describe('resolveComposeTool', () => {
  it('returns undefined when no candidate answers', () => {
    expect(resolveComposeTool([{ engine: 'nope', compose: ['definitely-not-a-real-binary'] }])).toBeUndefined();
  });
});

describe('engineEnv', () => {
  it('points podman at a registries.conf so a short image name needs no prompt', () => {
    expect(engineEnv('podman')['CONTAINERS_REGISTRIES_CONF']).toMatch(/registries\.conf$/);
  });

  it('adds nothing for other engines', () => {
    expect(engineEnv('docker')).toEqual({});
  });
});
