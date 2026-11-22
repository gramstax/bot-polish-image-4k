#!/usr/bin/env bun
/**
 * One-time Google login into a Moli profile, driven by JS directly
 * (Playwright over CDP) — NOT via chrome://inspect or any manual
 * DevTools screencast.
 *
 *   bun run scripts/moli-login.mjs --profile-dir ./moli-profile [--port 9222]
 *
 * How it works:
 *   1. Starts `moli serve` with the given persistent profile dir.
 *   2. Opens accounts.google.com in Moli and fills the sign-in form
 *      with the email/password you type in this terminal.
 *   3. If Google asks for 2FA, it waits: approve the prompt on your
 *      phone, or type the TOTP code here when asked.
 *   4. Verifies the login by opening gemini.google.com and checking
 *      the "Sign in" button is gone.
 *   5. Stops Moli gracefully so cookies flush to the profile dir.
 *
 * Credentials are typed in the terminal (password masked) and are
 * NEVER logged, stored, or written to disk. The profile dir afterwards
 * holds only the logged-in browser session (cookies.sqlite) — zip it
 * and give it to the bot (see README "One-time Google login").
 *
 * Runs under Bun or Node (playwright-core must be installed).
 */
import {spawn} from "node:child_process"
import {createInterface} from "node:readline"
import {homedir} from "node:os"
import {join} from "node:path"
import {chromium} from "playwright-core"

const DEFAULT_PORT = 9222
const LOGIN_WAIT_MS = 5 * 60_000
const STEP_TIMEOUT_MS = 60_000

function arg(name, fallback) {
  const i = process.argv.indexOf(name)
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback
}

const profileDir = arg(`--profile-dir`, `./moli-profile`)
const port = Number(arg(`--port`, String(DEFAULT_PORT)))
const moliBin = arg(`--moli-bin`, join(homedir(), `.local`, `bin`, `moli`))
const proxy = arg(`--proxy`, process.env.HTTP_PROXY ?? process.env.http_proxy ?? ``)
const cdpUrl = `http://127.0.0.1:${port}`

function log(msg) {
  console.log(`[moli-login] ${msg}`)
}

/** Ask a question in the terminal. Password input is masked with `*`. */
function ask(question, hidden) {
  return new Promise((resolve) => {
    const rl = createInterface({input: process.stdin, output: process.stdout})
    if (!hidden || typeof process.stdin.setRawMode !== `function`) {
      rl.question(question, (answer) => {
        rl.close()
        resolve(answer.trim())
      })
      return
    }
    process.stdout.write(question)
    let answer = ``
    process.stdin.setRawMode(true)
    process.stdin.resume()
    const onData = (chunk) => {
      const ch = chunk.toString(`utf8`)
      if (ch === `\n` || ch === `\r` || ch === `\u0004`) {
        process.stdin.setRawMode(false)
        process.stdin.removeListener(`data`, onData)
        process.stdout.write(`\n`)
        rl.close()
        resolve(answer.trim())
      } else if (ch === `\u0003`) {
        process.stdin.setRawMode(false)
        process.exit(130)
      } else if (ch === `\u007f`) {
        if (answer.length > 0) {
          answer = answer.slice(0, -1)
          process.stdout.write(`\b \b`)
        }
      } else {
        answer += ch
        process.stdout.write(`*`)
      }
    }
    process.stdin.on(`data`, onData)
  })
}

async function waitForCdp(timeoutMs) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(`${cdpUrl}/json/version`)
      if (res.ok) return
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`moli serve did not answer on ${cdpUrl} within ${timeoutMs} ms`)
}

/** True when the page looks logged in to Google (no "Sign in" button). */
async function isLoggedIn(page) {
  const signIn = page.locator(`button:has-text("Sign in"), a:has-text("Sign in")`).first()
  return (await signIn.count()) === 0
}

async function main() {
  const args = [`serve`, `--layout`, `-p`, String(port), `-P`, profileDir, `--log-level`, `error`]
  if (proxy.trim() !== ``) args.push(`--http-proxy`, proxy.trim())
  // Never log the proxy URL — it carries an egress credential.
  const shown = args.map((a, i) => (args[i - 1] === `--http-proxy` ? `<set>` : a))
  log(`starting: ${moliBin} ${shown.join(` `)}`)
  const moli = spawn(moliBin, args, {stdio: [`ignore`, `pipe`, `pipe`]})
  moli.stdout?.on(`data`, (d) => process.stdout.write(`[moli] ${d}`))
  moli.stderr?.on(`data`, (d) => process.stdout.write(`[moli] ${d}`))
  const stopMoli = () =>
    new Promise((resolve) => {
      if (moli.exitCode !== null) return resolve()
      moli.once(`exit`, () => resolve())
      moli.kill(`SIGTERM`)
      setTimeout(() => {
        try {
          moli.kill(`SIGKILL`)
        } catch {
          // already gone
        }
        resolve()
      }, 5_000).unref?.()
    })
  process.on(`SIGINT`, async () => {
    await stopMoli()
    process.exit(130)
  })

  try {
    await waitForCdp(30_000)
    log(`moli serve is up on ${cdpUrl}`)
    const browser = await chromium.connectOverCDP(cdpUrl)
    const page = browser.contexts()[0]?.pages()[0] ?? (await browser.newPage())
    log(`opening Google sign-in…`)
    await page.goto(`https://accounts.google.com/signin`, {waitUntil: `domcontentloaded`, timeout: STEP_TIMEOUT_MS})

    const email = process.env.GOOGLE_EMAIL?.trim() ?? (await ask(`Google email: `, false))
    if (email === ``) throw new Error(`email is empty`)
    await page.locator(`input[type="email"]`).first().fill(email, {timeout: STEP_TIMEOUT_MS})
    await page.locator(`#identifierNext`).first().click({timeout: STEP_TIMEOUT_MS})
    await page.locator(`input[type="password"]`).first().waitFor({state: `visible`, timeout: STEP_TIMEOUT_MS})

    const password = await ask(`Google password (hidden): `, true)
    if (password === ``) throw new Error(`password is empty`)
    await page.locator(`input[type="password"]`).first().fill(password)
    await page.locator(`#passwordNext`).first().click({timeout: STEP_TIMEOUT_MS})

    log(`credentials submitted — waiting for login to finish (up to 5 min)…`)
    log(`if Google asks for 2FA, approve it on your phone, or type the code here when asked.`)
    const deadline = Date.now() + LOGIN_WAIT_MS
    let askedForCode = false
    while (Date.now() < deadline) {
      await page.waitForTimeout(3_000)
      // TOTP code field showing? Ask for the code once and submit it.
      const codeField = page.locator(`input#totpPin, input[type="tel"]`).first()
      if (!askedForCode && (await codeField.count()) > 0 && (await codeField.isVisible().catch(() => false))) {
        askedForCode = true
        const code = await ask(`2FA code: `, false)
        if (code !== ``) {
          await codeField.fill(code)
          const next = page.locator(`#totpNext, button:has-text("Next"), button:has-text("Verify")`).first()
          if ((await next.count()) > 0) await next.click({timeout: 10_000}).catch(() => {})
        }
        continue
      }
      // Logged in? Google redirects to myaccount/gemini with no sign-in button.
      const url = page.url()
      if (/myaccount\.google\.com|gemini\.google\.com\/app/.test(url)) {
        if (await isLoggedIn(page)) break
      }
    }
    if (Date.now() >= deadline) throw new Error(`login did not finish within 5 minutes`)

    log(`verifying on gemini.google.com…`)
    await page.goto(`https://gemini.google.com/`, {waitUntil: `domcontentloaded`, timeout: STEP_TIMEOUT_MS})
    await page.waitForTimeout(5_000)
    if (!(await isLoggedIn(page))) {
      throw new Error(`gemini.google.com still shows a Sign in button — login did not stick`)
    }
    await browser.close()
    log(`LOGIN OK — Gemini shows a signed-in session.`)
    log(`Profile dir: ${profileDir}`)
    log(`Zip it and give it to the bot (see README "One-time Google login").`)
  } finally {
    await stopMoli()
    log(`moli serve stopped (cookies flushed to the profile dir).`)
  }
}

main().catch((err) => {
  console.error(`[moli-login] FAILED: ${err instanceof Error ? err.message : String(err)}`)
  process.exit(1)
})
