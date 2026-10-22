export const AVATAR_EXAMPLES = {
  'avatar/avatar-custom-initials-and-colors': () =>
    import('./avatar-custom-initials-and-colors.example').then((m) => m.AvatarCustomInitialsAndColorsExampleComponent),
  'avatar/avatar-default': () => import('./avatar-default.example').then((m) => m.AvatarDefaultExampleComponent),
};
