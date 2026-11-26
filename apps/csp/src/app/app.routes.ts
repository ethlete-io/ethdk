import { Routes } from '@angular/router';
import { ButtonRouteComponent } from './routes/button.component';
import { DevtoolsRouteComponent } from './routes/devtools.component';
import { MarkdownRouteComponent } from './routes/markdown.component';
import { MenuTooltipRouteComponent } from './routes/menu-tooltip.component';
import { NegativeControlComponent } from './routes/negative-control.component';
import { OverlayRouteComponent } from './routes/overlay.component';
import { RichTextRouteComponent } from './routes/rich-text.component';
import { SkeletonRouteComponent } from './routes/skeleton.component';
import { TableRouteComponent } from './routes/table.component';
import { ThemingRouteComponent } from './routes/theming.component';

export const routes: Routes = [
  { path: 'overlay', component: OverlayRouteComponent },
  { path: 'menu-tooltip', component: MenuTooltipRouteComponent },
  { path: 'button', component: ButtonRouteComponent },
  { path: 'table', component: TableRouteComponent },
  { path: 'theming', component: ThemingRouteComponent },
  { path: 'legacy-theming', loadChildren: () => import('./routes/legacy-theming.routes') },
  { path: 'markdown', component: MarkdownRouteComponent },
  { path: 'rich-text', component: RichTextRouteComponent },
  { path: 'skeleton', component: SkeletonRouteComponent },
  { path: 'devtools', component: DevtoolsRouteComponent },
  { path: 'negative-control', component: NegativeControlComponent },
];
