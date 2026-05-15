import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'et-sb-nav-route-one',
  template: `<div class="p-4">Route One Content</div>`,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavRouteOneComponent {}

@Component({
  selector: 'et-sb-nav-route-two',
  template: `<div class="p-4">Route Two Content</div>`,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavRouteTwoComponent {}

@Component({
  selector: 'et-sb-nav-route-three',
  template: `<div class="p-4">Route Three Content</div>`,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavRouteThreeComponent {}

@Component({
  selector: 'et-sb-nav-route-four',
  template: `<div class="p-4">Route Four Content</div>`,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavRouteFourComponent {}
