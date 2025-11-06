import { CdkPortalOutlet } from '@angular/cdk/portal';
import { DOCUMENT } from '@angular/common';
import { ComponentFactoryResolver, Directive, OnDestroy, OnInit, ViewContainerRef, inject } from '@angular/core';

@Directive({
  selector: '[etInlineTabBodyHost]',
  standalone: true,
  host: {
    class: 'et-inline-tab-body-host',
  },
})
export class InlineTabBodyHostDirective extends CdkPortalOutlet implements OnInit, OnDestroy {
  constructor() {
    const componentFactoryResolver = inject(ComponentFactoryResolver);
    const viewContainerRef = inject(ViewContainerRef);
    const _document = inject<Document>(DOCUMENT);

    super(componentFactoryResolver, viewContainerRef, _document);
  }
}
