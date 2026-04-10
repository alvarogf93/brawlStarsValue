#!/bin/bash
# Pre-push hook: validates all 13 locale files have identical key structure
# Blocks push (exit 2) if any locale is missing keys vs es.json

INPUT=$(cat)
CWD=$(echo "$INPUT" | node -e "const d=require('fs').readFileSync(0,'utf8');console.log(JSON.parse(d).cwd)")

cd "$CWD"

RESULT=$(node -e "
const fs = require('fs');
const locales = ['es','en','fr','pt','de','it','ru','tr','pl','ar','ko','ja','zh'];

function flatKeys(obj, prefix) {
  let keys = [];
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      keys = keys.concat(flatKeys(v, prefix + k + '.'));
    } else {
      keys.push(prefix + k);
    }
  }
  return keys;
}

const esKeys = new Set(flatKeys(JSON.parse(fs.readFileSync('messages/es.json', 'utf8')), ''));
let issues = 0;

for (const l of locales) {
  if (l === 'es') continue;
  try {
    const obj = JSON.parse(fs.readFileSync('messages/' + l + '.json', 'utf8'));
    const lKeys = new Set(flatKeys(obj, ''));
    const missing = [...esKeys].filter(k => !lKeys.has(k));
    const extra = [...lKeys].filter(k => !esKeys.has(k));
    if (missing.length > 0) {
      console.error(l + ': MISSING ' + missing.length + ' keys: ' + missing.slice(0, 5).join(', ') + (missing.length > 5 ? '...' : ''));
      issues += missing.length;
    }
    if (extra.length > 0) {
      console.error(l + ': EXTRA ' + extra.length + ' keys: ' + extra.slice(0, 3).join(', '));
    }
  } catch (e) {
    console.error(l + ': INVALID JSON');
    issues++;
  }
}

if (issues > 0) {
  console.error('[i18n] ' + issues + ' missing keys found — push blocked');
  process.exit(1);
} else {
  process.exit(0);
}
" 2>&1)

EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
  echo "[pre-push-i18n] Translation keys mismatch:" >&2
  echo "$RESULT" >&2
  exit 2
fi

exit 0
