import { Component, DestroyRef, ViewEncapsulation, inject } from '@angular/core';
import { CanvasFrame } from '../components/design-canvas/canvas-frame';
import { DesignCanvasComponent } from '../components/design-canvas/design-canvas.component';

const STATES = ['default', 'hover', 'disabled'];
const PRESETS = [
  { name: 'Mobile', width: 375 },
  { name: 'Tablet', width: 768 },
  { name: 'Desktop', width: 1280 },
];

const MOCK_SCREENSHOT = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="400"><rect width="100%" height="100%" fill="#e8ecf8"/><text x="40" y="80" font-size="48" font-family="sans-serif">Cached screenshot</text></svg>',
)}`;

const mockPage = (state: string, width: number) => `<!doctype html>
<html>
  <head>
    <style>
      body { margin: 0; padding: 24px; font: 15px/1.5 system-ui, sans-serif; background: #fff; color: #1b1b1f; }
      .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; }
      .card { padding: 16px; border: 1px solid #ddd; border-radius: 8px; }
      button { padding: 8px 16px; border: 0; border-radius: 6px; background: #3a5bd9; color: #fff; cursor: pointer; }
      button:hover { background: #1f3ba8; }
      button:disabled { background: #bbb; cursor: default; }
    </style>
  </head>
  <body>
    <h1>Button, ${state}</h1>
    <p>Mock frame at ${width} px. The grid wraps, so the content height follows the width.</p>
    <div class="grid">
      ${Array.from(
        { length: 6 },
        (_, i) =>
          `<div class="card"><p>Card ${i + 1}</p><button ${state === 'disabled' ? 'disabled' : ''}>Action</button></div>`,
      ).join('')}
    </div>
  </body>
</html>`;

@Component({
  selector: 'ethlete-canvas-demo-view',
  template: `<ethlete-design-canvas [frames]="frames" />`,
  encapsulation: ViewEncapsulation.None,
  imports: [DesignCanvasComponent],
  styles: `
    ethlete-canvas-demo-view {
      display: block;
      height: 100dvh;
    }
  `,
})
export class CanvasDemoViewComponent {
  protected frames: CanvasFrame[] = STATES.flatMap((state) =>
    PRESETS.map(({ name, width }) => ({
      id: `${state}-${width}`,
      src: URL.createObjectURL(new Blob([mockPage(state, width)], { type: 'text/html' })),
      width,
      height: state === 'disabled' ? 480 : undefined,
      label: name,
      row: state,
      screenshot: state === 'hover' && width === 1280 ? MOCK_SCREENSHOT : undefined,
      error: state === 'disabled' && width === 768 ? 'Render failed: mock error for the canvas demo.' : undefined,
    })),
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => this.frames.forEach((frame) => URL.revokeObjectURL(frame.src)));
  }
}
