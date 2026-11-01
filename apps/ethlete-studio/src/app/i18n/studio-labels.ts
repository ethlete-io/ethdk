export const STUDIO_LABELS = {
  treeRow: {
    sketchInProgress: 'Entwurf in Arbeit',
    sketchReady: 'Entwurf fertig',
    openComments: (count: number) => (count === 1 ? '1 offener Kommentar' : `${count} offene Kommentare`),
  },
} as const;
