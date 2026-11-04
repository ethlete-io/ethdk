import { Component, ViewEncapsulation } from '@angular/core';

/**
 * A transparent cover after an iframe in a positioned parent that takes the pointer and wheel input meant for the
 * canvas. Under a `pointer-events: none` ancestor it needs `pointer-events-auto`. Workaround: WKWebView sends a
 * trackpad wheel into an iframe that `pointer-events: none` should exclude, so the canvas stopped panning over
 * frames (finding 381).
 */
@Component({
  selector: 'ethlete-frame-shield',
  template: '',
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'absolute inset-0',
    'data-frame-shield': '',
  },
})
export class FrameShieldComponent {}
