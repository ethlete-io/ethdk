import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { expectNothingRunsAfterDestroy } from './destroyed-mid-gesture';

@Component({ template: '' })
class GestureHostComponent {}

describe('expectNothingRunsAfterDestroy', () => {
  it('fails when a frame throws during the gesture, before the destroy', async () => {
    const fixture = TestBed.createComponent(GestureHostComponent);

    await expect(
      expectNothingRunsAfterDestroy({
        fixture,
        start: () => {
          requestAnimationFrame(() => {
            throw new Error('mid-gesture failure');
          });
        },
      }),
    ).rejects.toThrow('to deeply equal');
  });
});
