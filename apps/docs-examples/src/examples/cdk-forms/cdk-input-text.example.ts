import { Component, ViewEncapsulation } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { InputImports } from '@ethlete/cdk';

@Component({
  selector: 'app-cdk-input-text-example',
  template: `
    <et-input-field [formControl]="name">
      <et-label>Text input</et-label>
      <et-text-input placeholder="Your name" />
    </et-input-field>

    <et-input-field [formControl]="password">
      <et-label>Password</et-label>
      <et-password-input>
        <et-password-input-toggle etInputSuffix />
      </et-password-input>
    </et-input-field>

    <et-input-field [formControl]="search">
      <et-label>Search</et-label>
      <et-search-input>
        <et-search-input-clear *etIfInputFilled etInputSuffix />
      </et-search-input>
    </et-input-field>

    <et-input-field [formControl]="notes">
      <et-label>Notes</et-label>
      <et-textarea-input [etAutosizeMaxHeight]="160" etAutosize />
    </et-input-field>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [InputImports, ReactiveFormsModule],
})
export class CdkInputTextExampleComponent {
  public name = new FormControl('');
  public password = new FormControl('');
  public search = new FormControl('');
  public notes = new FormControl('');
}
