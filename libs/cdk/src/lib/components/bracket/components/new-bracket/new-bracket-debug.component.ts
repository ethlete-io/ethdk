import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, signal, ViewEncapsulation } from '@angular/core';
import { DrawManDebugData } from './drawing';

@Component({
  selector: 'et-new-bracket-debug',
  template: `
    @let data = drawManDebugData();

    <div class="et-new-bracket-debug-top-level">
      <p>
        ⇔: {{ data.position.inline.start }} - {{ data.position.inline.end }} ⇕: {{ data.position.block.start }} -
        {{ data.position.block.end }}
      </p>

      <button (click)="showAdditionalInfos.set(!showAdditionalInfos())" class="et-new-bracket-debug-toggle-detail-btn">
        Details
      </button>
    </div>

    @if (showAdditionalInfos()) {
      <pre>{{ data | json }}</pre>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-new-bracket-debug-host',
    '[class.et-new-bracket-debug-host--expanded]': 'showAdditionalInfos()',
  },
  styles: `
    .et-bracket-match-container {
      position: relative;
    }

    .et-new-bracket-debug-host {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      z-index: 1000;
      font-size: 12px;
      color: white;
      padding: 4px;
      border-radius: 4px;
      background: #000;
      overflow: auto;

      p {
        margin: 0;
        padding: 0;
      }

      &.et-new-bracket-debug-host--expanded {
        z-index: 1001;
      }
    }

    .et-new-bracket-debug-top-level {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      padding: 4px;
    }

    .et-new-bracket-debug-toggle-detail-btn {
      padding: 0;
      margin: 0;
      background: transparent;
      border: none;
      text-decoration: underline;
      text-align: left;
      color: inherit;
      cursor: pointer;
    }
  `,
  imports: [JsonPipe],
})
export class NewBracketDebugComponent {
  drawManDebugData = input.required<DrawManDebugData>();

  showAdditionalInfos = signal(false);
}
