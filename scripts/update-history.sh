#!/usr/bin/env bash
# The site and the collector read the same snapshot. Persist it on a separate data branch.
set -euo pipefail
history_dir="${RUNNER_TEMP:?}/pagewatch-history"
if git ls-remote --exit-code --heads origin refs/heads/history >/dev/null; then
  git fetch --no-tags --depth=1 origin refs/heads/history:refs/remotes/origin/history
  git worktree add -b history "$history_dir" refs/remotes/origin/history
  test -s "$history_dir/watch.json"
else
  status=$?
  if (( status != 2 )); then exit "$status"; fi
  git worktree add --detach "$history_dir" HEAD
  git -C "$history_dir" switch --orphan history
fi
node scripts/collect.mjs "$history_dir/watch.json"
git -C "$history_dir" add -- watch.json
git -C "$history_dir" -c user.name="github-actions[bot]" -c user.email="41898282+github-actions[bot]@users.noreply.github.com" commit -m "Record careers board check"
git push origin history:refs/heads/history
cp "$history_dir/watch.json" site/data/watch.json
