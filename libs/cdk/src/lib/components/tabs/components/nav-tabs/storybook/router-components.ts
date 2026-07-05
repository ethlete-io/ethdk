import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'et-router-component-one',
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `<h1>One</h1>`,
})
export class RouterOneComponent {}

@Component({
  selector: 'et-router-component-two',
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `<h1>Two</h1>`,
})
export class RouterTwoComponent {}

@Component({
  selector: 'et-router-component-three',
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `<h1>Three</h1>`,
})
export class RouterThreeComponent {}

@Component({
  selector: 'et-router-component-four',
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `<h1>Four</h1>`,
})
export class RouterFourComponent {}
