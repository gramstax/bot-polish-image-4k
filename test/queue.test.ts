import {afterEach, beforeEach, describe, expect, it} from "bun:test"
import {mkdtempSync, rmSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {Db} from "../src/db"

let dir = ``
let db: Db

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), `polish-queue-`))
  db = new Db(dir)
})

afterEach(async () => {
  await db.close()
  rmSync(dir, {recursive: true, force: true})
})

function draft(userId: number) {
  return {
    userId,
    chatId: userId,
    photoPath: `/tmp/input.png`,
    promptId: `upscale-colorize` as const,
    promptText: `upscale it`,
    promptName: `4K Upscale + Colorize`,
  }
}

describe(`JobRepository FIFO queue`, () => {
  it(`dequeues in enqueue order`, async () => {
    const a = await db.jobs.enqueue(draft(1))
    const b = await db.jobs.enqueue(draft(2))
    const c = await db.jobs.enqueue(draft(3))
    expect(db.jobs.queueSize()).toBe(3)
    expect(await db.jobs.dequeueJobId()).toBe(a.id)
    expect(await db.jobs.dequeueJobId()).toBe(b.id)
    expect(await db.jobs.dequeueJobId()).toBe(c.id)
    expect(await db.jobs.dequeueJobId()).toBeUndefined()
    expect(db.jobs.queueSize()).toBe(0)
  })

  it(`records the queue position at enqueue time`, async () => {
    const a = await db.jobs.enqueue(draft(1))
    const b = await db.jobs.enqueue(draft(2))
    expect(a.position).toBe(1)
    expect(b.position).toBe(2)
    expect(db.jobs.find(a.id)?.status).toBe(`queued`)
    expect(db.jobs.find(a.id)?.percent).toBe(5)
  })

  it(`peek shows the head without removing it`, async () => {
    const a = await db.jobs.enqueue(draft(1))
    expect(db.jobs.peekQueued()?.jobId).toBe(a.id)
    expect(db.jobs.queueSize()).toBe(1)
  })

  it(`recoverInterrupted marks stuck running jobs failed`, async () => {
    const a = await db.jobs.enqueue(draft(1))
    const b = await db.jobs.enqueue(draft(2))
    await db.jobs.setStatus(a.id, `running`)
    await db.jobs.setStatus(b.id, `done`)
    expect(await db.jobs.recoverInterrupted()).toBe(1)
    expect(db.jobs.find(a.id)?.status).toBe(`failed`)
    expect(db.jobs.find(a.id)?.errorCode).toBe(`interrupted`)
    expect(db.jobs.find(b.id)?.status).toBe(`done`)
    expect(await db.jobs.recoverInterrupted()).toBe(0)
  })
})

describe(`SessionRepository 50-request rule`, () => {
  it(`starts a new chat on the first request`, async () => {
    const next = await db.session.nextRequest()
    expect(next.isNewChat).toBe(true)
    expect(next.requestCount).toBe(1)
    expect(next.chatUrl).toBe(``)
  })

  it(`reuses the same chat for requests 2-50`, async () => {
    await db.session.nextRequest()
    await db.session.setChatUrl(`https://gemini.google.com/app/abc`)
    for (let i = 2; i <= 50; i++) {
      const next = await db.session.nextRequest()
      expect(next.isNewChat).toBe(false)
      expect(next.requestCount).toBe(i)
      expect(next.chatUrl).toBe(`https://gemini.google.com/app/abc`)
    }
  })

  it(`starts a NEW chat on the 51st request and resets the counter`, async () => {
    for (let i = 0; i < 50; i++) await db.session.nextRequest()
    const next = await db.session.nextRequest()
    expect(next.isNewChat).toBe(true)
    expect(next.requestCount).toBe(1)
    expect(next.chatUrl).toBe(``)
  })
})

describe(`UserRepository prompt prefs + recent jobs`, () => {
  const profile = {username: `u`, firstName: `U`}

  it(`defaults to the colorize preset, idle state, no custom text`, () => {
    const pref = db.user.promptPref(7)
    expect(pref.promptId).toBe(`upscale-colorize`)
    expect(pref.customPrompt).toBe(``)
    expect(pref.promptState).toBe(`idle`)
  })

  it(`saves preset + custom text + typing state`, async () => {
    await db.user.setPromptId(7, `custom`, profile)
    await db.user.setCustomPrompt(7, `make it pop`, profile)
    await db.user.setPromptState(7, `awaiting-custom`, profile)
    const pref = db.user.promptPref(7)
    expect(pref.promptId).toBe(`custom`)
    expect(pref.customPrompt).toBe(`make it pop`)
    expect(pref.promptState).toBe(`awaiting-custom`)
  })

  it(`recent jobs keep only the newest 5, newest first`, async () => {
    for (let i = 1; i <= 7; i++) {
      await db.user.addRecentJob(7, `job-${i}`, profile)
    }
    expect(db.user.recentJobIds(7)).toEqual([`job-7`, `job-6`, `job-5`, `job-4`, `job-3`])
  })

  it(`clearPolishData wipes jobs + custom prompt`, async () => {
    await db.user.setCustomPrompt(7, `x`, profile)
    await db.user.addRecentJob(7, `job-1`, profile)
    await db.user.clearPolishData(7)
    expect(db.user.recentJobIds(7)).toEqual([])
    expect(db.user.promptPref(7).customPrompt).toBe(``)
  })
})
