import { answerPoolJobs } from './sync-pool';
import { variantAnswerOf, VariantJob } from './read-open-points';
import { replaceHeldEdits } from './sketch/held-edits';

answerPoolJobs((job: VariantJob) => {
  replaceHeldEdits(job.held);

  return variantAnswerOf(job);
});
