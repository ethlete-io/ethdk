import { Component, signal } from '@angular/core';
import '../../../../test-helpers';
import { mountDurationInput } from '../../testing/duration-input-driver';
import { DurationInputComponent } from './duration-input.component';

@Component({
  template: `<et-duration-input [(value)]="value" aria-label="Duration" />`,
  imports: [DurationInputComponent],
})
class Host {
  value = signal<number | null>(3600);
}

describe('DurationInputComponent - clear button', () => {
  it('shows on an unfocused field that holds a value', () => {
    const driver = mountDurationInput(Host);

    driver.detectChanges();

    expect(driver.query('.et-duration-input-clear')).not.toBeNull();
  });
});
