<ng-template>
    <et-breadcrumbs>
        <a *etBreadcrumbItem> Home </a>
        <a *etBreadcrumbItem> Competitions </a>
        <span *etBreadcrumbItem> Competition 1 </span>
    </et-breadcrumbs>
</ng-template>

```ts
export class BreadcrumbsComponent {
  breadcrumbs = contentChildren(BreadcrumbItemDirective);
  breadcrumbService = inject(BreadcrumbService);

  constructor() {
    this.breadcrumbService.activeBreadcrumbComponent.set(this.breadcrumbs);
  }
}
```

```ts
export class BreadcrumbItemDirective {
  templateRef = inject(TemplateRef);
}
```

```ts
export class BreadcrumbService {
    activeBreadcrumbs = signal<Signal<BreadcrumbItemDirective[]> | null>(null);

    isLgMin = injectObserveBreakpoint({min: "lg"}):

    breadcrumbToRender = computed(() => {
        const breadcrumbs = this.activeBreadcrumbs()?.();
        const isLgMin = this.isLgMin();

        if(!breadcrumbs?.length) {
            return null;
        }

        if(isLgMin) {
            return breadcrumbs.map(breadcrumb => ({
                type: "breadcrumb",
                item: breadcrumb
            }));
        }

        if(breadcrumbs.length < 4) {
            return breadcrumbs.map(breadcrumb => ({
                type: "breadcrumb",
                item: breadcrumb
            }));
        }

        const first = breadcrumbs[0];
        const last = breadcrumbs[breadcrumbs.length - 1];
        const inBetween = breadcrumbs.slice(1, breadcrumbs.length - 1);

        return [{
            type: "breadcrumb",
            item: first
        }, {
            type: "menu",
            items: inBetween
        }, {
            type: "breadcrumb",
            item: last
        }];

    })
}
```

<et-breadcrumbs-outlet>

```ts
export class BreadcrumbOutletComponent {
  breadcrumbService = inject(BreadcrumbService);
}
```

@for (item of breadcrumbService.breadcrumbToRender(); track $index) {
@if(item.type === "breadcrumb") {
<ng-container [ngTemplateOutlet]="item.item"/>
} @else {
<button etMenuTrigger="menuTpl"> Rest </button>

        <ng-template menuTpl>
            <et-menu>
                @for (item of item.items; track $index) {
                    <et-menu-item>
                        <ng-container [ngTemplateOutlet]="item"/>
                    </et-menu-item>
                }
            </et-menu>
        </ng-template>
    }

}
