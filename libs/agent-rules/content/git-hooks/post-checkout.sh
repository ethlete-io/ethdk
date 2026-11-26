if [ "$3" = "1" ] && [ -z "$ETHLETE_GIT_FLOW_SKIP" ] && [ -x node_modules/.bin/ethlete-agents ]; then
  ethlete_branch=$(git rev-parse --abbrev-ref HEAD)

  # Only while the branch is on no remote: that is the whole window in which renaming it is free.
  if [ -z "$(git for-each-ref --format='%(refname)' "refs/remotes/*/$ethlete_branch")" ]; then
    node_modules/.bin/ethlete-agents git-flow check || true
  fi

  unset ethlete_branch
fi
