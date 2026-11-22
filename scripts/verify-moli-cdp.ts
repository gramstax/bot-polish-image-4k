/**
 * verify-moli-cdp.ts — one-off check that Bun can drive Moli over CDP.
 *
 * Spawns `moli serve` with a scratch profile, connects with
 * playwright-core's connectOverCDP, opens example.com (title check)
 * and gemini.google.com (login-wall check), then shuts Moli down.
 * Run: `bun run scripts/verify-moli-cdp.ts` — NOT part of test:all.
 */
import {spawn, type Subprocess} from "bun"
import {chromium} from "playwright-core"
import {existsSync, mkdirSync, rmSync} from "node:fs"
import {join} from "node:path"

const PROFILE = join(import.meta.dir, `..`, `tmp-moli-verify`)
const MOLI = `${process.env.HOME}/.local/bin/moli`
const CDP = `http://127.0.0.1:9222`

async function waitForCdp(timeoutMs = 30_000): Promise<void> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(`${CDP}/json/version`)
      if (res.ok) return
    } catch {
      // Not up yet.
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`CDP did not come up at ${CDP}`)
}

async function main(): Promise<void> {
  rmSync(PROFILE, {recursive: true, force: true})
  mkdirSync(PROFILE, {recursive: true})
  const proxy = process.env.HTTP_PROXY ?? ``
  const args = [`serve`, `--layout`, `-P`, PROFILE, `--log-level`, `error`]
  if (proxy !== ``) args.push(`--http-proxy`, proxy)
  console.log(`starting: moli ${args.join(` `)}`)
  const moli: Subprocess = spawn([MOLI, ...args], {stdout: `ignore`, stderr: `ignore`})
  try {
    await waitForCdp()
    console.log(`CDP up at ${CDP}`)
    const browser = await chromium.connectOverCDP(CDP)
    const context = browser.contexts()[0] ?? (await browser.newContext())
    const page = context.pages()[0] ?? (await context.newPage())
    await page.goto(`https://example.com`, {waitUntil: `domcontentloaded`, timeout: 30_000})
    console.log(`example.com title:`, JSON.stringify(await page.title()))
    await page.goto(`https://gemini.google.com/`, {waitUntil: `domcontentloaded`, timeout: 30_000})
    const bodyText = (await page.textContent(`body`)) ?? ``
    console.log(`gemini login wall present:`, /sign in/i.test(bodyText))
    console.log(`gemini prompt box present:`, (await page.locator(`div.ql-editor[contenteditable="true"]`).count()) > 0)
    await browser.close()
    console.log(`BUN + PLAYWRIGHT-CORE + CDP: OK`)
  } finally {
    moli.kill()
    await new Promise((r) => setTimeout(r, 1000))
    rmSync(PROFILE, {recursive: true, force: true})
  }
}

main().catch((err) => {
  console.error(`VERIFY FAILED:`, err instanceof Error ? err.message : err)
  process.exit(1)
})
