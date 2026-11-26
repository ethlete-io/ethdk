import { getTestBed } from '@angular/core/testing';
import { beforeEach } from 'vitest';

/**
 * Turns `TestBed`'s unknown-element and unknown-property errors on for a whole spec project.
 * Call it right after analog's `setupTestBed()`.
 *
 * analog's helper does not forward `TestEnvironmentOptions` to `initTestEnvironment`, so the only
 * way to set them is to tear the environment it just built back down and rebuild it with the same
 * platform and modules. Setting the flags per spec is not an alternative:
 * `configureTestingModule` assigns the instance-level option unconditionally, so any later call in
 * the same test - `configureTestingModule({ providers })` to swap a provider, for instance - resets
 * it and the environment default takes over again.
 *
 * The empty `configureTestingModule` is what makes the environment options reach the renderer:
 * Angular pushes them into the global strict-mode flags from `configureTestingModule` only, so a
 * spec that goes straight to `TestBed.createComponent` would otherwise still run unguarded. It has
 * to be registered after `setupTestBed()`, whose own `beforeEach` resets the testing module.
 */
export const applyStrictTestEnvironment = () => {
  const testBed = getTestBed();
  const { ngModule, platform } = testBed;

  testBed.resetTestEnvironment();
  testBed.initTestEnvironment(ngModule, platform, {
    teardown: { destroyAfterEach: true },
    errorOnUnknownElements: true,
    errorOnUnknownProperties: true,
  });

  beforeEach(() => getTestBed().configureTestingModule({}));
};
