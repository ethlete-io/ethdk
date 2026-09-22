import { Component, ViewEncapsulation } from '@angular/core';
import { injectFocusVisibleTracker } from '../../focus-visible-tracker';

@Component({
  selector: 'et-sb-focus-visible-tracker',
  template: `
    <div class="flex flex-col gap-4 p-8 font-sans">
      <div class="flex gap-4">
        <button type="button">First</button>
        <button type="button">Second</button>
        <input aria-label="Text" type="text" />
      </div>
      <output data-testid="focus-visible">{{ tracker.isFocusVisible() }}</output>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
})
export class FocusVisibleTrackerStorybookComponent {
  protected tracker = injectFocusVisibleTracker();
}
