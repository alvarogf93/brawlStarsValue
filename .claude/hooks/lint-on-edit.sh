#!/bin/bash
# Post-edit hook: runs ESLint on edited files to catch issues early
# Non-blocking (exit 0) — just provides feedback

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | node -e "const d=require('fs').readFileSync(0,'utf8');const p=JSON.parse(d);console.log(p.tool_input?.file_path||'')")

# Only lint .ts/.tsx files
if [[ "$FILE_PATH" != *.ts && "$FILE_PATH" != *.tsx ]]; then
  exit 0
fi

# Skip test files and node_modules
if [[ "$FILE_PATH" == *node_modules* || "$FILE_PATH" == *__tests__* ]]; then
  exit 0
fi

CWD=$(echo "$INPUT" | node -e "const d=require('fs').readFileSync(0,'utf8');console.log(JSON.parse(d).cwd)")
cd "$CWD"

LINT_OUTPUT=$(npx eslint "$FILE_PATH" --no-warn-ignored 2>&1)
LINT_EXIT=$?

if [ $LINT_EXIT -ne 0 ]; then
  echo "[lint] Issues in $(basename "$FILE_PATH"):" >&2
  echo "$LINT_OUTPUT" >&2
fi

exit 0
