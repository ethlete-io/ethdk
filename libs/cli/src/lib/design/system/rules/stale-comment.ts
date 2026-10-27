import { goneStateOf, listComments, staleReasonOf } from '../comments/comment';
import { listNotes } from '../notes/note';
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

/** A note whose part or state is gone, and a note file that cannot be read. */
export const staleNotesOf = (product: ResolvedProduct): Problem[] => {
  const { notes, unreadable } = listNotes(product.dir);

  return [
    ...unreadable.map(({ file, problem }) => ({ rule: 'NOTE', file, message: problem })),
    ...notes.flatMap((note) => {
      const gone = goneStateOf({ product, part: note.part, state: note.state });

      return gone ? [{ rule: 'NOTE', file: note.file, message: `${gone} - move or drop the note` }] : [];
    }),
  ];
};
