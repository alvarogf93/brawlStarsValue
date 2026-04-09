#!/bin/bash
# Pre-push hook: runs TypeScript check before allowing git push
# Blocks the push (exit 2) if tsc finds errors

INPUT=$(cat)
CWD=$(echo "$INPUT" | node -e "const d=require('fs').readFileSync(0,'utf8');console.log(JSON.parse(d).cwd)")

cd "$CWD"

echo "[pre-push] Running TypeScript check..." >&2
TSC_OUTPUT=$(npx tsc --noEmit 2>&1)
TSC_EXIT=$?

if [ $TSC_EXIT -ne 0 ]; then
  echo "[pre-push] TypeScript errors found — push blocked:" >&2
  echo "$TSC_OUTPUT" >&2
  exit 2
fi

echo "[pre-push] TypeScript OK" >&2
exit 0
