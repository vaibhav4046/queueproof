#!/usr/bin/env bash
# Vercel "Ignored Build Step" script.
#
# Exit 0  -> skip the build (the previous production deployment keeps serving)
# Exit 1  -> run the build
#
# Rationale: every build re-arms the release-binding gate, which invalidates the
# same-SHA benchmark artifacts published at /api/lab. Documentation, submission
# copy, screenshots, benchmark result files, and video assets do not change the
# deployed application, so they must not trigger a rebuild.

set -u

# Without a parent commit we cannot compare; build to stay safe.
if ! git rev-parse HEAD^ >/dev/null 2>&1; then
  echo "no parent commit available, building"
  exit 1
fi

CHANGED="$(git diff --name-only HEAD^ HEAD)"

if [ -z "$CHANGED" ]; then
  echo "no changed files, building"
  exit 1
fi

while IFS= read -r file; do
  [ -z "$file" ] && continue
  case "$file" in
    *.md|docs/*|submission/*|evals/results/*|video/*|.github/ISSUE_TEMPLATE/*)
      continue
      ;;
    *)
      echo "application file changed: $file"
      exit 1
      ;;
  esac
done <<EOF
$CHANGED
EOF

echo "documentation-only change, skipping build"
exit 0
