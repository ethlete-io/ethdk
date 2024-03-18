Inside a normal overlay:

```html
<et-overlay-sidebar>
  <ng-template etOverlayHeaderContent>
    <h1>Navigation</h1>
  </ng-template>

  <button etOverlayLink="general">General settings</button>
</et-overlay-sidebar>

<main>
  <et-overlay-header>
    @if(shouldRenderBackButton()) {
    <button etOverlaySidebarLink>Back</button>
    }
    <ng-container *ngTemplateOutlet="activePage.header()" />
    <button etOverlayClose>Close</button>
  </et-overlay-header>

  <et-overlay-body>
    <et-overlay-page-outlet />
  </et-overlay-body>

  @if(hasFooterContents()) {
  <!--
        This might get hacky on mobile where the sidebar is a "fake" page. 
        In that case we want to slide the footer out and only once it's no longer on screen replace it with the actual footer??
        Maybe we should always render the current footer and the previous one and then just slide the previous one out and the current in?
        After that, we can destroy the previous one.
    -->
  <et-overlay-footer>
    <ng-container *ngTemplateOutlet="activePage.footer()" />
  </et-overlay-footer>
  }
</main>
```

The "general" component.

```html
<ng-template etOverlayHeaderContent>
  <h1>General settings</h1>
</ng-template>

<ng-template etOverlayFooterContent>
  <button etOverlayClose>Save</button>
</ng-template>

<form>...</form>
```

The "overlay-sidebar" component.

```html
<ng-template>
  <ng-content />
</ng-template>

<!-- 
    Will only be rendered once a specific viewport is reached. 
    Otherwise the templates will be put inside a "fake" page that can be displayed via the page-outlet
-->
@if(shouldRenderSidebar()) {
<aside>
  <ng-container *ngTemplateOutlet="template" />
</aside>
}
```

```ts
const template = viewChild.required(TemplateRef);
const headerContent = contentChild('etOverlayHeaderContent');
const footerContent = contentChild('etOverlayFooterContent');
```
