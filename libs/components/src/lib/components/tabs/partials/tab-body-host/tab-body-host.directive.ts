import { CdkPortalOutlet } from '@angular/cdk/portal';
import { DOCUMENT } from '@angular/common';
import { Directive, OnInit, OnDestroy, ComponentFactoryResolver, ViewContainerRef, Inject } from '@angular/core';

@Directive({
  selector: '[etTabBodyHost]',
  standalone: true,
  host: {
    class: 'et-tab-body-host',
  },
})
export class TabBodyPortalDirective extends CdkPortalOutlet implements OnInit, OnDestroy {
  constructor(
    componentFactoryResolver: ComponentFactoryResolver,
    viewContainerRef: ViewContainerRef,
    @Inject(DOCUMENT) _document: Document,
  ) {
    super(componentFactoryResolver, viewContainerRef, _document);
  }
}
