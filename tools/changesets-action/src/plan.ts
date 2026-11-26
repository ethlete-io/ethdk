import type { NewChangeset } from "@changesets/types";

export type RunPlan = {
  publish: boolean;
  version: boolean;
};

// `changeset publish` skips every version the registry already has, so it runs on each push:
// a changeset pushed before the merged version PR's run went green must not hold that release back.
export function planRun({
  changesets,
  hasPublishScript,
}: {
  changesets: NewChangeset[];
  hasPublishScript: boolean;
}): RunPlan {
  return {
    publish: hasPublishScript,
    version: changesets.some((changeset) =>
      changeset.releases.some((release) => release.type !== "none"),
    ),
  };
}
