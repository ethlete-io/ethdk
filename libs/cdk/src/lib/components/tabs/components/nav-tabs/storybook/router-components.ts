import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'et-router-component-one',
  template: `<h1>One</h1>`,
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: true,
})
export class RouterOneComponent {}

@Component({
  selector: 'et-router-component-two',
  template: `<h1>Two</h1>`,
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: true,
})
export class RouterTwoComponent {}

@Component({
  selector: 'et-router-component-three',
  template: `<h1>Three</h1>`,
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: true,
})
export class RouterThreeComponent {}

@Component({
  selector: 'et-router-component-four',
  template: `<h1>Four</h1>`,
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: true,
})
export class RouterFourComponent {}
