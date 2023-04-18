import { CdkPortalOutlet } from '@angular/cdk/portal';
import { DOCUMENT } from '@angular/common';
import { ComponentFactoryResolver, Directive, Inject, OnDestroy, OnInit, ViewContainerRef } from '@angular/core';

@Directive({
  selector: '[etInlineTabBodyHost]',
  standalone: true,
  host: {
    class: 'et-inline-tab-body-host',
  },
})
export class InlineTabBodyHostDirective extends CdkPortalOutlet implements OnInit, OnDestroy {
  constructor(
    componentFactoryResolver: ComponentFactoryResolver,
    viewContainerRef: ViewContainerRef,
    @Inject(DOCUMENT) _document: Document,
  ) {
    super(componentFactoryResolver, viewContainerRef, _document);
  }
}
