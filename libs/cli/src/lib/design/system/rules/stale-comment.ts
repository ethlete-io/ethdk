import { listComments, staleReasonOf } from '../comments/comment';
import { listNotes, MISSING_NOTE_SIZE, noteProblemOf } from '../notes/note';
import { Problem } from '../problem';
import { ResolvedProduct } from '../resolve-product';

/** An open comment whose part, state, size or sketch variant is gone, and a comment file that cannot be read. */
export const staleCommentsOf = (product: ResolvedProduct): Problem[] => {
  const { comments, unreadable } = listComments({ productDir: product.dir, product: product.name });

  return [
    ...unreadable.map(({ file, problem }) => ({ rule: 'COMMENT', file, message: problem })),
    ...comments.flatMap((comment) => {
      const reason = staleReasonOf({ product, comment });

      return reason ? [{ rule: 'COMMENT', file: comment.file, message: `${reason} - answer or drop the comment` }] : [];
    }),
  ];
};

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
