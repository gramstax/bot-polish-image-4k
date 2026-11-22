/**
 * Gemini automation — drive gemini.google.com through the Moli browser.
 *
 * Selectors come from the probe (~/workspace/polish-bot-probe/REPORT.md,
 * logged-out EN UI) and the manual guide
 * (restored-content-factory/polish-gemini-web/PANDUAN.md, logged-in ID UI).
 * Anything NOT observed in the probe is marked UNPROVEN and has a
 * fallback — the upload menu item text, the send button, and the
 * download button all need a logged-in session to confirm, and the
 * first live run must update this file (and PANDUAN.md) with what was
 * actually seen.
 *
 * Honest failures only: a login wall, a failed upload, a generation
 * timeout, or a failed download throw a typed GeminiError with a
 * machine-readable `code` — the worker turns the code into a clear
 * user message. Nothing here ever fakes a result.
 */
import {copyFile, writeFile} from "node:fs/promises"
import type {Browser, Page} from "playwright-core"

/** Selectors observed in the probe (logged-out EN UI). */
export const SELECTORS = {
  /** Prompt box (Quill editor). */
  promptBox: `div.ql-editor[contenteditable="true"]`,
  /** "+" button that opens the upload menu. */
  uploadButton: `button[aria-label="Upload & tools"]`,
  /** File input — appears only after the upload menu opens. */
  fileInput: `input[type=file]`,
  /** Response images hosted by Google. */
  resultImage: `img[src*="googleusercontent"]`,
  /** Chat history container (data-test-id seen in the probe). */
  chatHistory: `[data-test-id="chat-history-container"]`,
} as const

/** Send-button candidates (UNPROVEN — the button only appears after text is typed). */
export const SEND_BUTTON_SELECTORS = [
  `button[aria-label="Send message"]`,
  `button[aria-label="Send"]`,
  `button[data-test-id="send-button"]`,
] as const

/** Upload menu item texts (EN from the probe era, ID from PANDUAN.md). */
export const UPLOAD_MENU_TEXTS = [`Upload files`, `Unggah file`] as const

/** Download button label fragments (UNPROVEN — seen only in PANDUAN.md as "Download gambar ukuran penuh"). */
export const DOWNLOAD_LABEL_FRAGMENTS = [`Download full-size image`, `Download image`, `Download gambar ukuran penuh`, `Unduh`] as const

export type PolishStage = `browser-ready` | `uploaded` | `prompt-sent` | `generating` | `downloading` | `done`

export const STAGE_PERCENTS: Record<PolishStage, number> = {
  "browser-ready": 15,
  uploaded: 25,
  "prompt-sent": 40,
  generating: 60,
  downloading: 85,
  done: 100,
}

export type GeminiErrorCode = `login-needed` | `upload-failed` | `generation-timeout` | `download-failed` | `browser-failed`

export class GeminiError extends Error {
  constructor(
    readonly code: GeminiErrorCode,
    message: string,
  ) {
    super(message)
    this.name = `GeminiError`
  }
}

/**
 * Pure login-wall check (unit-tested): the prompt box is absent AND the
 * page is either on Google's login host or still shows a "Sign in" button.
 * The live check builds this from the Playwright page.
 */
export function isLoginWall(opts: {url: string; bodyText: string; promptBoxCount: number}): boolean {
  if (opts.promptBoxCount > 0) return false
  if (/accounts\.google\.com/i.test(opts.url)) return true
  return /sign in/i.test(opts.bodyText)
}

export interface IPolishProgress {
  percent: number
  stage: PolishStage
}

export interface IRunPolishOptions {
  page: Page
  baseUrl: string
  /** Saved Gemini chat URL to reuse; empty = open a new chat. */
  chatUrl: string
  photoPath: string
  promptText: string
  outPath: string
  onProgress: (progress: IPolishProgress) => Promise<void> | void
  /** Max wait for the generated image (default 10 minutes). */
  generationTimeoutMs?: number
}

export interface IRunPolishResult {
  resultPath: string
  /** The chat URL after the polish (persist it — the next 49 requests reuse it). */
  chatUrl: string
}

/**
 * One polish through the Gemini website. Returns the downloaded result
 * path + the chat URL to persist for session reuse.
 */
export async function runPolish(opts: IRunPolishOptions): Promise<IRunPolishResult> {
  const {page, baseUrl} = opts
  const generationTimeoutMs = opts.generationTimeoutMs ?? 600_000
  let chatUrl = opts.chatUrl
  try {
    // 1. Open the saved chat, or a fresh chat when there is none.
    // A saved URL that fails to load gets ONE retry as a new chat.
    try {
      await page.goto(chatUrl !== `` ? chatUrl : baseUrl, {waitUntil: `domcontentloaded`, timeout: 30_000})
    } catch (err) {
      if (chatUrl === ``) throw err
      chatUrl = ``
      await page.goto(baseUrl, {waitUntil: `domcontentloaded`, timeout: 30_000})
    }
    await assertLoggedIn(page)
    await opts.onProgress({percent: STAGE_PERCENTS[`browser-ready`], stage: `browser-ready`})

    // 2. Upload the photo.
    const beforeSrcs = new Set(await page.locator(SELECTORS.resultImage).evaluateAll((imgs) => imgs.map((i) => (i as {src: string}).src)))
    await uploadPhoto(page, opts.photoPath)
    await opts.onProgress({percent: STAGE_PERCENTS.uploaded, stage: `uploaded`})

    // 3. Paste the prompt verbatim and send.
    await page.locator(SELECTORS.promptBox).first().click({timeout: 15_000})
    await page.locator(SELECTORS.promptBox).first().fill(opts.promptText)
    const pasted = (await page.locator(SELECTORS.promptBox).first().textContent()) ?? ``
    if (!pasted.includes(opts.promptText.slice(0, 20))) {
      throw new GeminiError(`upload-failed`, `the prompt did not land in the Gemini prompt box`)
    }
    await clickSend(page)
    await opts.onProgress({percent: STAGE_PERCENTS[`prompt-sent`], stage: `prompt-sent`})

    // 4. Wait for the generated image.
    await opts.onProgress({percent: STAGE_PERCENTS.generating, stage: `generating`})
    const imageSrc = await waitForNewImage(page, beforeSrcs, generationTimeoutMs)
    await opts.onProgress({percent: STAGE_PERCENTS.downloading, stage: `downloading`})

    // 5. Download it (button first, direct fetch as fallback).
    await downloadImage(page, imageSrc, opts.outPath)
    await opts.onProgress({percent: STAGE_PERCENTS.done, stage: `done`})
    return {resultPath: opts.outPath, chatUrl: page.url()}
  } catch (err) {
    if (err instanceof GeminiError) throw err
    throw new GeminiError(`browser-failed`, err instanceof Error ? err.message : String(err))
  }
}

async function assertLoggedIn(page: Page): Promise<void> {
  const promptBoxCount = await page.locator(SELECTORS.promptBox).count()
  const bodyText = (await page.textContent(`body`)) ?? ``
  if (isLoginWall({url: page.url(), bodyText, promptBoxCount})) {
    throw new GeminiError(
      `login-needed`,
      `Gemini shows a login wall — the Google session in the Moli profile is missing or expired`,
    )
  }
}

async function uploadPhoto(page: Page, photoPath: string): Promise<void> {
  // The file input only exists after the upload menu opens.
  let input = page.locator(SELECTORS.fileInput)
  if ((await input.count()) === 0) {
    await page.locator(SELECTORS.uploadButton).first().click({timeout: 15_000})
    // Menu item: "Upload files" (EN) or "Unggah file" (ID).
    let clicked = false
    for (const text of UPLOAD_MENU_TEXTS) {
      const item = page.getByText(text, {exact: true}).first()
      if ((await item.count()) > 0) {
        await item.click({timeout: 10_000})
        clicked = true
        break
      }
    }
    if (!clicked) {
      // No menu item matched — the input may still have appeared.
      await page.waitForSelector(SELECTORS.fileInput, {timeout: 10_000})
    }
    input = page.locator(SELECTORS.fileInput)
  }
  try {
    await input.first().setInputFiles(photoPath, {timeout: 15_000})
  } catch (err) {
    throw new GeminiError(`upload-failed`, `could not attach the photo to Gemini: ${err instanceof Error ? err.message : String(err)}`)
  }
  // The composer shows the attached photo as a thumbnail — wait for it.
  try {
    await page.waitForSelector(`${SELECTORS.chatHistory} img, ${SELECTORS.promptBox} >> xpath=ancestor::div[contains(@class, "textarea")]//img`, {timeout: 30_000})
  } catch {
    // Thumbnail wait is best-effort: the file input accepted the file,
    // and the prompt send below will surface a real failure if not.
  }
}

async function clickSend(page: Page): Promise<void> {
  for (const selector of SEND_BUTTON_SELECTORS) {
    const button = page.locator(selector).first()
    if ((await button.count()) > 0) {
      await button.click({timeout: 10_000})
      return
    }
  }
  // Fallback (UNPROVEN): Enter sends in the Gemini composer.
  await page.locator(SELECTORS.promptBox).first().press(`Enter`)
}

async function waitForNewImage(page: Page, beforeSrcs: Set<string>, timeoutMs: number): Promise<string> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const srcs = await page.locator(SELECTORS.resultImage).evaluateAll((imgs) => imgs.map((i) => (i as {src: string}).src))
    const fresh = srcs.find((src) => !beforeSrcs.has(src))
    if (fresh !== undefined) return fresh
    await page.waitForTimeout(5_000)
  }
  throw new GeminiError(`generation-timeout`, `Gemini did not return an image within ${Math.round(timeoutMs / 1000)}s`)
}

async function downloadImage(page: Page, imageSrc: string, outPath: string): Promise<void> {
  // Try the hover download button first (UNPROVEN selector set).
  try {
    const img = page.locator(`img[src="${imageSrc}"]`).first()
    await img.hover({timeout: 10_000})
    for (const fragment of DOWNLOAD_LABEL_FRAGMENTS) {
      const button = page.getByLabel(new RegExp(fragment, `i`)).first()
      if ((await button.count()) > 0) {
        const downloadPromise = page.waitForEvent(`download`, {timeout: 30_000}).catch(() => undefined)
        await button.click({timeout: 10_000})
        const download = await downloadPromise
        if (download !== undefined) {
          await download.saveAs(outPath)
          return
        }
      }
    }
  } catch {
    // Fall through to the direct fetch below.
  }
  // Fallback: fetch the image URL with the browser's cookies.
  const response = await page.request.get(imageSrc, {timeout: 60_000})
  if (!response.ok()) {
    throw new GeminiError(`download-failed`, `could not download the result image (HTTP ${response.status()})`)
  }
  await writeFile(outPath, Buffer.from(await response.body()))
}

/**
 * Mock polish (POLISH_MOCK_AI=1, used by e2e + the mock pipeline script):
 * returns a byte copy of the input as the "polished" result, reporting
 * the same staged progress the live flow reports. Deterministic — no
 * browser, no login, no network.
 */
export async function mockPolish(
  photoPath: string,
  outPath: string,
  onProgress: (progress: IPolishProgress) => Promise<void> | void,
): Promise<IRunPolishResult> {
  const stages: PolishStage[] = [`browser-ready`, `uploaded`, `prompt-sent`, `generating`, `downloading`, `done`]
  for (const stage of stages) {
    await onProgress({percent: STAGE_PERCENTS[stage], stage})
  }
  await copyFile(photoPath, outPath)
  return {resultPath: outPath, chatUrl: ``}
}
