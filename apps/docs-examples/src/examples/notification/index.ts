export const NOTIFICATION_EXAMPLES = {
  'notification/notification-default': () =>
    import('./notification-default.example').then((m) => m.NotificationDefaultExampleComponent),
  'notification/notification-promise': () =>
    import('./notification-promise.example').then((m) => m.NotificationPromiseExampleComponent),
  'notification/notification-rtl': () =>
    import('./notification-rtl.example').then((m) => m.NotificationRtlExampleComponent),
  'notification/notification-custom': () =>
    import('./notification-custom.example').then((m) => m.NotificationCustomExampleComponent),
};
