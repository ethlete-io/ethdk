import { CdkPortalOutlet } from '@angular/cdk/portal';
import { Directive, OnDestroy, OnInit } from '@angular/core';

@Directive({
  selector: '[etInlineTabBodyHost]',
  standalone: true,
  host: {
    class: 'et-inline-tab-body-host',
  },
})
export class InlineTabBodyHostDirective extends CdkPortalOutlet implements OnInit, OnDestroy {}
