#!/usr/bin/env node
/**
 * Simple git push wrapper.
 *
 * Usage:
 *   node scripts/git-push.js                     → push current branch to origin
 *   node scripts/git-push.js main                → push main to origin
 *   node scripts/git-push.js main upstream       → push main to upstream
 */

const { execSync } = require('child_process')

function run(cmd) {
  return execSync(cmd, { encoding: 'utf-8' }).trim()
}

try {
  const branch = process.argv[2] || run('git rev-parse --abbrev-ref HEAD')
  const remote = process.argv[3] || 'origin'

  console.log(`→ Pushing ${branch} to ${remote}...`)
  const output = execSync(`git push ${remote} ${branch}`, {
    encoding: 'utf-8',
    stdio: ['inherit', 'pipe', 'pipe'],
  })
  if (output) console.log(output)
  console.log(`✓ Push complete: ${remote}/${branch}`)
} catch (err) {
  console.error(`✗ Push failed`)
  if (err.stderr) console.error(err.stderr.toString())
  else console.error(err.message)
  process.exit(1)
}
