import { ChangeDetectionStrategy, Component, ViewEncapsulation, input } from '@angular/core';
import { GRID_2X2_ICON, PENCIL_ICON, PLUS_ICON, provideIcons } from '../../../icon';
import { TAB_SIZES } from '../../tab-sizes';
import { TabGroupComponent } from '../../tabs/tab-group.component';
import { TabLabelDirective } from '../../tabs/tab-label.directive';
import { TabComponent } from '../../tabs/tab.component';

const SIZES = Object.values(TAB_SIZES);

@Component({
  selector: 'et-sb-tabs',
  template: `
    <div class="flex flex-col gap-8 p-8 font-sans">
      @for (size of SIZES; track size) {
        <div class="flex flex-col gap-3">
          <p class="m-0 text-xs font-semibold uppercase tracking-widest">{{ size }}</p>
          <et-tab-group
            [orientation]="orientation()"
            [fit]="fit()"
            [divider]="divider()"
            [variant]="variant()"
            [preserveContent]="preserveContent()"
            [sessionMemoryKey]="sessionMemoryKey()"
            [size]="size"
            [color]="color()"
          >
            <et-tab [disabled]="disabled()" icon="et-grid-2x2" label="First">
              <div class="p-4">Content of the first tab</div>
            </et-tab>
            <et-tab [disabled]="disabled()" icon="et-pencil" label="Second">
              <div class="p-4">Content of the second tab</div>
            </et-tab>
            <et-tab [disabled]="disabled()" icon="et-plus" label="Third">
              <div class="p-4">Content of the third tab</div>
            </et-tab>
          </et-tab-group>
        </div>
      }

      <div class="flex flex-col gap-3">
        <p class="m-0 text-xs font-semibold uppercase tracking-widest">custom labels</p>
        <et-tab-group [color]="color()">
          <et-tab>
            <ng-template etTabLabel>
              <span>🏠 Home</span>
            </ng-template>
            <div class="p-4">Home content</div>
          </et-tab>
          <et-tab>
            <ng-template etTabLabel>
              <span>⚙️ Settings</span>
            </ng-template>
            <div class="p-4">Settings content</div>
          </et-tab>
        </et-tab-group>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TabGroupComponent, TabComponent, TabLabelDirective],
  providers: [provideIcons(GRID_2X2_ICON, PENCIL_ICON, PLUS_ICON)],
})
export class TabsStorybookComponent {
  orientation = input<'horizontal' | 'vertical'>('horizontal');
  variant = input<'primary' | 'secondary'>('secondary');
  fit = input<'content' | 'fill'>('content');
  divider = input(true);
  disabled = input(false);
  preserveContent = input(true);
  sessionMemoryKey = input<string | null>(null);
  color = input<string | null>('brand');
  readonly SIZES = SIZES;
}
