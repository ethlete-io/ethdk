import { commentDraft } from '@system/components/comment-draft';

const CARD =
  'rounded-md border border-(--et-surface-border-solid) bg-(--et-surface-background-solid) p-space-3 shadow-lg';

export const bareCommentDraft = async (text: string) => {
  const draft = await commentDraft({ text });
  return { body: draft.body.replace(CARD, 'p-space-3'), styles: draft.styles };
};
