/**
 * Photo intake — save the user's Telegram photo to the job directory.
 *
 * Live: `getFile` + the Telegram file URL (the bot token comes from env,
 * never from a message). Mock: write a tiny fixture PNG so e2e runs
 * without Telegram downloads — the mock polisher then copies it as the
 * "polished" result and the strip step re-encodes it.
 */
import {mkdirSync} from "node:fs"
import {writeFile} from "node:fs/promises"
import {join} from "node:path"
import type {Api} from "grammy"

/** 1x1 white PNG (base64) — the mock-mode fixture photo. */
export const MOCK_PHOTO_BASE64 = `iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==`

export function mockPhotoBytes(): Buffer {
  return Buffer.from(MOCK_PHOTO_BASE64, `base64`)
}

export async function saveMockPhoto(dir: string, fileName = `input.png`): Promise<string> {
  mkdirSync(dir, {recursive: true})
  const path = join(dir, fileName)
  await writeFile(path, mockPhotoBytes())
  return path
}

export async function saveTelegramPhoto(api: Api, botToken: string, fileId: string, dir: string, fileName = `input.jpg`): Promise<string> {
  const file = await api.getFile(fileId)
  if (!file.file_path) throw new Error(`Telegram did not return a file path for the photo`)
  const url = `https://api.telegram.org/file/bot${botToken}/${file.file_path}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Telegram file download failed (HTTP ${res.status})`)
  mkdirSync(dir, {recursive: true})
  const path = join(dir, fileName)
  await writeFile(path, Buffer.from(await res.arrayBuffer()))
  return path
}
