import { listComments, staleReasonOf } from '../comments/comment';
import { Problem } from '../problem';
import { ResolvedProduct } from '../resolve-product';

/** An open comment whose part, state, preset or sketch variant is gone, and a comment file that cannot be read. */
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
