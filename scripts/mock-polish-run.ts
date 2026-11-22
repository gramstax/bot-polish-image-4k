/**
 * mock-polish-run.ts
 *
 * Mock-mode polish pipeline end-to-end, no browser, no Gemini, no login:
 *   photo in -> mock polish -> metadata strip + byte-scan verify -> result out
 *
 * Usage:
 *   bun run mock:polish [input-photo]
 *   bun run scripts/mock-polish-run.ts [input-photo]
 *
 * With no argument it uses the 1x1 mock fixture PNG. The output lands in
 * ./jobs-mock-run/ (git-ignored) and the script prints each stage, the
 * strip result, and the byte-scan verdict. Exit code 1 if the strip
 * verification fails — a result is never "done" while markers survive.
 */
import {mkdir, stat} from "node:fs/promises"
import {join} from "node:path"
import {mockPolish} from "../src/lib/gemini"
import {saveMockPhoto} from "../src/lib/photos"
import {hasAiMarkers, stripAndVerify} from "../src/lib/strip"

const OUT_DIR = `./jobs-mock-run`

async function main(): Promise<void> {
  const inputArg = process.argv[2]
  await mkdir(OUT_DIR, {recursive: true})

  const inputPath = inputArg ?? (await saveMockPhoto(OUT_DIR, `input.png`))
  const rawPath = join(OUT_DIR, `polished-raw.png`)
  const finalPath = join(OUT_DIR, `polished-final.png`)

  console.log(`input: ${inputPath}`)
  await mockPolish(inputPath, rawPath, ({percent, stage}) => {
    console.log(`  ${String(percent).padStart(3, ` `)}%  ${stage}`)
  })
  console.log(`mock result: ${rawPath}`)

  const stripped = await stripAndVerify(rawPath, finalPath)
  const {size} = await stat(stripped)
  console.log(`stripped result: ${stripped} (${size} bytes)`)

  // Independent re-check: read the final file back and byte-scan it.
  const {readFile} = await import(`node:fs/promises`)
  const bytes = await readFile(stripped)
  if (hasAiMarkers(bytes)) {
    console.error(`FAIL: AI markers still present in the stripped result`)
    process.exit(1)
  }
  console.log(`byte-scan: clean — no C2PA / SynthID / XMP / JUMBF markers`)
  console.log(`OK: mock polish pipeline end-to-end passed`)
}

await main()
