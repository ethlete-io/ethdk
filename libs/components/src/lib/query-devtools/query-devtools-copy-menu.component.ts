import { Component, computed, input, output, ViewEncapsulation } from '@angular/core';
import { injectStyleManager } from '@ethlete/core';
import { MenuComponent, MenuDirective, MenuItemComponent } from '../menu';
import { MenuSurfaceDirective, MenuTriggerDirective } from '../menu/headless';
import { QueryDevtoolsCopyMenuStylesComponent } from './query-devtools-copy-menu-styles.component';
import { JsonKind } from './query-devtools-json.component';

/** Which of a node's four pasteable forms a copy action asks for. */
export type QueryDevtoolsCopyPayload = 'value' | 'key' | 'path' | 'entry';

/**
 * The caret beside the value explorer's `⧉`, offering the key and the JSONPath that button cannot
 * reach. It only picks - the explorer node owns the clipboard write and the tick, so all four
 * payloads share one implementation and one "what landed" readout.
 *
 * @internal
 */
@Component({
  selector: 'et-query-devtools-copy-menu',
  template: `
    <div class="et-query-devtools-json-copy-menu" etMenu>
      <button
        class="et-query-devtools-json-copy-more"
        type="button"
        aria-label="More copy options"
        title="Copy the key or the path instead of the value"
        etMenuTrigger
      >
        ▾
      </button>

      <ng-template etMenuSurface>
        <et-menu>
          <button (activate)="pick.emit('value')" et-menu-item type="button">Value</button>
          @if (namedByKey()) {
            <button (activate)="pick.emit('key')" et-menu-item type="button">Key</button>
          }
          <button (activate)="pick.emit('path')" et-menu-item type="button">Path</button>
          @if (namedByKey()) {
            <button (activate)="pick.emit('entry')" et-menu-item type="button">"key": value</button>
          }
        </et-menu>
      </ng-template>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [MenuDirective, MenuTriggerDirective, MenuSurfaceDirective, MenuComponent, MenuItemComponent],
})
export class QueryDevtoolsCopyMenuComponent {
  /** The kind of the container this node sits in, or `null` at an explorer root. */
  public parentKind = input<JsonKind | null>(null);

  public pick = output<QueryDevtoolsCopyPayload>();

  /**
   * Whether the node's key is worth having on its own. An array element's key is its index, so both
   * "Key" and the `"key": value` fragment would produce `0` / `"0": …` - the path is the only useful
   * address there.
   */
  protected namedByKey = computed(() => this.parentKind() !== 'array');

  constructor() {
    injectStyleManager().mount(QueryDevtoolsCopyMenuStylesComponent);
  }
}
