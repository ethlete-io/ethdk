import { ChangeDetectionStrategy, Component, inject, ViewEncapsulation } from '@angular/core';
import {
  OverlayBodyComponent,
  OverlayCloseDirective,
  OverlayFooterDirective,
  OverlayHeaderDirective,
  OverlayMainDirective,
  OverlayTitleDirective,
} from '../../common';
import { OVERLAY_DATA } from '../../overlay-manager';
import { OVERLAY_PANEL_STYLES } from './story-styles';

export type OverlaySimpleContentData = {
  title?: string;
  description?: string;
};

/**
 * Simple, reusable overlay content component used across all story scenarios.
 * Accepts optional `title` and `description` via {@link OVERLAY_DATA}.
 *
 * Also injects the global overlay panel theme styles (background, border-radius,
 * drag-handle colour) so that any story rendering this component gets a consistent look.
 */
@Component({
  selector: 'et-sb-overlay-content',
  template: `
    <div etOverlayHeader>
      <h3 etOverlayTitle>{{ data?.title ?? 'Demo Overlay' }}</h3>
    </div>

    <et-overlay-body dividers="dynamic">
      @if (data?.description) {
        <p class="et-sb-oc-ctx">{{ data!.description }}</p>
      }
      <p>Lorem ipsum dolor sit amet consectetur adipisicing elit. Vero, quia.</p>
      <p>
        Labore ex natus libero nulla omnis dolores minima fuga animi ipsum est delectus, numquam cum architecto! Aperiam
        adipisci praesentium incidunt voluptatum repellendus voluptas.
      </p>
      <p>Lorem ipsum dolor sit amet consectetur adipisicing elit.</p>
      <p>Lorem ipsum dolor sit amet consectetur adipisicing elit. Labore ex natus libero nulla.</p>
      <p>
        Labore ex natus libero nulla. Aperiam adipisci praesentium incidunt voluptatum repellendus voluptas voluptatibus
        cupiditate sed illum nobis sit, illo itaque explicabo accusamus.
      </p>
    </et-overlay-body>

    <div etOverlayFooter>
      <button etOverlayClose type="button">Close</button>
    </div>
  `,
  styles: [
    OVERLAY_PANEL_STYLES,
    `
      et-sb-overlay-content {
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      et-sb-overlay-content .et-overlay-header {
        border-bottom: 1px solid #27272a;
      }
      et-sb-overlay-content .et-overlay-footer {
        border-top: 1px solid #27272a;
      }

      et-sb-overlay-content h3 {
        font-size: 0.9375rem;
        font-weight: 600;
        margin: 0;
      }

      et-sb-overlay-content p {
        line-height: 1.6;
        margin: 0 0 0.75rem;
      }

      et-sb-overlay-content p:last-child {
        margin-bottom: 0;
      }

      et-sb-overlay-content .et-sb-oc-ctx {
        background: rgba(255, 255, 255, 0.06);
        border-radius: 6px;
        font-size: 0.8125rem;
        font-style: italic;
        padding: 0.5rem 0.75rem;
      }

      et-sb-overlay-content button[etOverlayClose] {
        background: transparent;
        border: 1px solid #3f3f46;
        border-radius: 5px;
        color: inherit;
        cursor: pointer;
        font-family: inherit;
        font-size: 0.8125rem;
        padding: 6px 14px;
        transition: background 0.15s;
      }

      et-sb-overlay-content button[etOverlayClose]:hover {
        background: #27272a;
      }
    `,
  ],
  imports: [
    OverlayTitleDirective,
    OverlayCloseDirective,
    OverlayHeaderDirective,
    OverlayBodyComponent,
    OverlayFooterDirective,
  ],
  hostDirectives: [OverlayMainDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class OverlaySimpleContentComponent {
  protected readonly data = inject<OverlaySimpleContentData | null>(OVERLAY_DATA);
}
