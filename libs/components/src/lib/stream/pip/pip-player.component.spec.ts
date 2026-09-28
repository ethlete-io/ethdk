import { TestBed } from '@angular/core/testing';
import '../../../test-helpers';
import { PipPlayerComponent } from './pip-player.component';

describe('PipPlayerComponent', () => {
  it('names the missing entry when it has neither an entry input nor a pip cell', () => {
    const fixture = TestBed.createComponent(PipPlayerComponent);

    expect(() => fixture.detectChanges()).toThrow(/needs an `entry` input or a parent `etPipCell`/);
  });
});
