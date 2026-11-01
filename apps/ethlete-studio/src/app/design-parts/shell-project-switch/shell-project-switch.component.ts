import { Component, input, model, output, ViewEncapsulation } from '@angular/core';
import { BUTTON_IMPORTS, MENU_IMPORTS } from '@ethlete/components';
import { AutoSurfaceDirective } from '@ethlete/core';

@Component({
  selector: 'ethlete-shell-project-switch',
  templateUrl: './shell-project-switch.component.html',
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, MENU_IMPORTS, AutoSurfaceDirective],
  host: { class: 'box-border block w-62 p-space-2' },
})
export class ShellProjectSwitchComponent {
  public project = input('ethlete-sdk');
  public projects = input(['ethlete-sdk', 'fut-frontend', 'design-playground']);
  public open = model(false);

  public projectChange = output<string>();
  public openProject = output();

  protected selectProject(value: unknown) {
    if (typeof value === 'string') this.projectChange.emit(value);
  }
}
