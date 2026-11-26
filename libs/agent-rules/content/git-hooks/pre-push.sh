# Never `npx`: it reaches the registry when the package is absent, and a network error here would
# reject the push. A missing binary must make this block do nothing at all.
if [ -z "$ETHLETE_GIT_FLOW_SKIP" ] && [ -x node_modules/.bin/ethlete-agents ]; then
  node_modules/.bin/ethlete-agents git-flow check --push || exit 1
fi
