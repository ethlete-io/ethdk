import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it, vi } from 'vitest';
import { checkoutGoneOf, watchCheckout } from './checkout-gone';

const checkout = () => {
  const target = mkdtempSync(join(tmpdir(), 'resident-checkout-'));
  const entry = join(target, 'dist/libs/cli/src/index.js');

  mkdirSync(join(target, 'dist/libs/cli/src'), { recursive: true });
  writeFileSync(entry, '');

  return { target, entry };
};

describe('checkoutGoneOf', () => {
  it('answers null while the checkout and the entry exist', () => {
    expect(checkoutGoneOf(checkout())).toBeNull();
  });

  it('names a deleted checkout', () => {
    const { target, entry } = checkout();

    rmSync(target, { recursive: true });

    expect(checkoutGoneOf({ target, entry })).toBe(`checkout ${target} is gone`);
  });

  it('names a deleted entry file', () => {
    const { target, entry } = checkout();

    rmSync(entry);

    expect(checkoutGoneOf({ target, entry })).toBe(`entry ${entry} is gone`);
  });
});

describe('watchCheckout', () => {
  it('calls onGone once after the checkout is deleted, and not before', async () => {
    const { target, entry } = checkout();
    const onGone = vi.fn();
    const watch = watchCheckout({ target, entry, onGone, everyMs: 10 });

    await new Promise((done) => setTimeout(done, 50));
    expect(onGone).not.toHaveBeenCalled();

    rmSync(target, { recursive: true });

    await vi.waitFor(() => expect(onGone).toHaveBeenCalledWith(`checkout ${target} is gone`));
    await new Promise((done) => setTimeout(done, 50));
    expect(onGone).toHaveBeenCalledTimes(1);
    expect(watch.closed).toBe(true);
  });
});
