import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { QueryDevtoolsComponent } from '@ethlete/query';

@Component({
  standalone: true,
  imports: [RouterOutlet, RouterLink, QueryDevtoolsComponent],
  selector: 'ethlete-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {}
