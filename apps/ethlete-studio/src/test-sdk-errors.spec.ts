import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { watchSdkErrors } from './test-sdk-errors';

@Component({ selector: 'et-unlabelled', template: '' })
class UnlabelledComponent {
  constructor() {
    console.error('ERROR', new Error('ET1234: The control has no accessible name.'));
  }
}

describe('watchSdkErrors', () => {
  it('names the code and message of each SDK error and lets other errors pass', () => {
    const logged: unknown[][] = [];
    const target = { error: (...args: unknown[]) => logged.push(args) };
    const take = watchSdkErrors(target);

    target.error('plain error');

    expect(take()).toBeNull();

    target.error('ERROR', new Error('ET1234: The control has no accessible name.'));
    target.error('ERROR', new Error('ET1234: The control has no accessible name.'));

    expect(take()).toBe('the test logged SDK errors:\n  ET1234: The control has no accessible name.');
    expect(take()).toBeNull();
    expect(logged).toHaveLength(3);
  });

  it.fails('fails a test whose component logs an SDK error', () => {
    TestBed.createComponent(UnlabelledComponent);
  });
});
