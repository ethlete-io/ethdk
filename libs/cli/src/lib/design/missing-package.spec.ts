import { describe, expect, it } from 'vitest';
import { missingPackageMessage } from './missing-package';

describe('missingPackageMessage', () => {
  it('names the missing package and the checkout', () => {
    const error = new Error("Cannot find package '@angular/platform-server' imported from /work/app/package.json");

    expect(missingPackageMessage(error, '/work/app')).toBe(
      'ng() needs @angular/platform-server in /work/app; install it as a dev dependency.',
    );
  });

  it('ignores other errors', () => {
    expect(missingPackageMessage(new Error('boom'), '/work/app')).toBeNull();
    expect(missingPackageMessage(new Error("Cannot find package 'lodash' imported from x"), '/work/app')).toBeNull();
  });
});
