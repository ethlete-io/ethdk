import { relative } from 'path';
import { listComments, sketchGoneOf, staleReasonOf } from '../comments/comment';
import { listNotes, MISSING_NOTE_SIZE, noteProblemOf } from '../notes/note';
import { Problem } from '../problem';
import { ResolvedProduct } from '../resolve-product';

/** An open comment whose part, state, size or sketch variant is gone, and a comment file that cannot be read. */
export const staleCommentsOf = (product: ResolvedProduct): Problem[] => {
  const { comments, unreadable } = listComments({ productDir: product.dir, product: product.name });

  return [
    ...unreadable.map(({ file, problem }) => ({ rule: 'COMMENT', file, message: problem })),
    ...comments.flatMap((comment) => {
      if (sketchGoneOf({ product, comment })) return [];

      const reason = staleReasonOf({ product, comment });

      return reason ? [{ rule: 'COMMENT', file: comment.file, message: `${reason} - answer or drop the comment` }] : [];
    }),
  ];
};

/** An open comment made on a sketch that was merged, discarded or replaced: it needs a reply or the user's resolve, but blocks nothing. */
export const goneSketchCommentWarningsOf = (product: ResolvedProduct): string[] =>
  listComments({ productDir: product.dir, product: product.name }).comments.flatMap((comment) =>
    sketchGoneOf({ product, comment })
      ? [
          `COMMENT ${relative(product.dir, comment.file)}: the sketch on ${comment.sketch?.target} no longer exists - reply with \`comment reply --by\`, or the user resolves the comment in Studio`,
        ]
      : [],
  );

/** A note whose part, state or size is gone, a pointed note without a size, and a note file that cannot be read. */
export const staleNotesOf = (product: ResolvedProduct): Problem[] => {
  const { notes, unreadable } = listNotes(product.dir);

  return [
    ...unreadable.map(({ file, problem }) => ({ rule: 'NOTE', file, message: problem })),
    ...notes.flatMap((note) => {
      const gone = noteProblemOf({ product, note });

      if (!gone) return [];

      return [
        {
          rule: 'NOTE',
          file: note.file,
          message: gone === MISSING_NOTE_SIZE ? gone : `${gone} - move or drop the note`,
        },
      ];
    }),
  ];
};
