import { CdkPortalOutlet } from '@angular/cdk/portal';
import { Directive, OnDestroy, OnInit } from '@angular/core';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Directive({
  selector: '[etInlineTabBodyHost]',

  host: {
    class: 'et-inline-tab-body-host et-legacy',
  },
})
export class InlineTabBodyHostDirective extends CdkPortalOutlet implements OnInit, OnDestroy {}
