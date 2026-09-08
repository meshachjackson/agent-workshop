import { spawn } from 'node:child_process'
import assert from 'node:assert/strict'
const child = spawn(process.execPath, ['.output/server/index.mjs'], { env: { ...process.env, HOST:'127.0.0.1', PORT:'3198', NUXT_TEAM_PASSWORD:'' }, stdio:'pipe' })
try {
  let response
  for (let i=0; i<100; i++) { try { response=await fetch('http://127.0.0.1:3198'); break } catch {} await new Promise(r=>setTimeout(r,100)) }
  assert.equal(response?.status,503,'production refuses access without a configured password')
  assert.equal((await fetch('http://127.0.0.1:3198/api/run',{method:'POST'})).status,503)
  console.log('PASS: unconfigured production page and API fail closed')
} finally { child.kill() }
