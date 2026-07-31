/**
 * Mojibake guard — fails on cp1252 artifacts in tracked source and docs.
 *
 *   node scripts/check-encoding.mjs
 *
 * WHY THIS EXISTS. Twice in feedback pass 3 a PowerShell
 * `Get-Content`/`Set-Content` round-trip decoded a UTF-8 file as
 * Windows-1252 and re-encoded it, turning every non-ASCII character into a
 * two- or three-character artifact. The second time it corrupted THREE GERMAN
 * BUTTON LABELS that `scripts/ui-gallery-chat.mjs` clicks — the script could
 * no longer find them, and nothing failed until the next run.
 *
 * The app is German. Umlauts and ß appear in user-facing strings, in document
 * names, and in selectors that match them. A silent encoding corruption is a
 * correctness bug here, not a cosmetic one, so it gets a check.
 *
 * The signature is unambiguous: a UTF-8 lead byte (Ã, Â, â) followed by the
 * character its continuation byte maps to in cp1252. Real German text never
 * produces those pairs.
 */

import { readFileSync } from 'fs'
import { execSync } from 'child_process'

const EXTS = /\.(ts|tsx|js|mjs|cjs|css|md|sql|json|yml|yaml)$/
const ROOTS = ['app/', 'components/', 'lib/', 'scripts/', 'docs/', 'tests/', 'supabase/']

/**
 * Ã / Â / â followed by a character in the range cp1252 maps the UTF-8
 * continuation bytes onto. Anchored on the lead byte so ordinary text such as
 * "Ärztin" or "Âge" cannot match — those are a lead byte followed by a normal
 * letter, not by a control-range or punctuation-range character.
 */
const MOJIBAKE = /[ÂÃâ][-¿Œ-Ÿ–-™]/g

const files = execSync('git ls-files', { encoding: 'utf8' })
  .split('\n')
  .filter((f) => f && EXTS.test(f) && ROOTS.some((r) => f.startsWith(r)))

const hits = []
for (const f of files) {
  let text
  try {
    text = readFileSync(f, 'utf8')
  } catch {
    continue
  }
  const lines = text.split('\n')
  lines.forEach((line, i) => {
    const m = line.match(MOJIBAKE)
    if (m)
      hits.push({
        file: f,
        line: i + 1,
        found: [...new Set(m)].join(' '),
        text: line.trim().slice(0, 90),
      })
  })
}

if (hits.length) {
  console.error(`\n✖ Encoding check FAILED — ${hits.length} line(s) contain cp1252 mojibake:\n`)
  for (const h of hits) {
    console.error(`  ${h.file}:${h.line}  [${h.found}]`)
    console.error(`     ${h.text}`)
  }
  console.error(
    '\nCause is almost always a PowerShell Get-Content/Set-Content round-trip.\n' +
      'Fix by restoring the file (git checkout <path>) and re-applying the edit\n' +
      "with an editor or Node's fs using an explicit utf8 encoding.\n"
  )
  process.exit(1)
}

console.log(`Encoding check passed — ${files.length} files, no cp1252 artifacts.`)
