import {afterEach, beforeEach, describe, expect, it} from "bun:test"
import {existsSync, mkdtempSync, readFileSync, rmSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import type {Api} from "grammy"
import {Db} from "../src/db"
import {GeminiError} from "../src/lib/gemini"
import {saveMockPhoto} from "../src/lib/photos"
import {hasAiMarkers} from "../src/lib/strip"
import {WorkerLoop} from "../src/lib/worker"

interface ICall {
  method: string
  args: unknown[]
}

let dir = ``
let jobsDir = ``
let db: Db
let calls: ICall[]
let fakeApi: Api

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), `polish-worker-`))
  jobsDir = join(dir, `jobs`)
  db = new Db(join(dir, `data`))
  calls = []
  fakeApi = {
    sendPhoto: async (chatId: number, photo: unknown) => {
      calls.push({method: `sendPhoto`, args: [chatId, photo]})
      return {message_id: 99} as never
    },
    editMessageText: async (chatId: number, messageId: number, text: string) => {
      calls.push({method: `editMessageText`, args: [chatId, messageId, text]})
      return true as never
    },
  } as unknown as Api
})

afterEach(async () => {
  await db.close()
  rmSync(dir, {recursive: true, force: true})
})

function mockCfg() {
  return {
    mockAi: true,
    allowedIds: new Set<number>(),
    dbPath: join(dir, `data`),
    jobsDir,
    moliBin: `moli`,
    moliProfileDir: join(dir, `moli-profile`),
    moliPort: 9222,
    moliProxy: ``,
    geminiChatUrl: ``,
    geminiBaseUrl: `https://gemini.google.com`,
  }
}

describe(`WorkerLoop mock pipeline (photo in -> result out -> stripped)`, () => {
  it(`processes one queued job: ACK edits with percents, stripped photo sent, record done`, async () => {
    const input = await saveMockPhoto(join(jobsDir, `pending`), `input.png`)
    const job = await db.jobs.enqueue({
      userId: 42,
      chatId: 42,
      photoPath: input,
      promptId: `upscale-colorize`,
      promptText: `upscale it`,
      promptName: `4K Upscale + Colorize`,
    })
    await db.jobs.update(job.id, {ackMessageId: 7})
    const worker = new WorkerLoop(db, fakeApi, mockCfg())
    const processed = await worker.processOne()
    expect(processed).toBe(job.id)

    const record = db.jobs.find(job.id)
    expect(record?.status).toBe(`done`)
    expect(record?.percent).toBe(100)
    expect(record?.resultPath).toBe(join(jobsDir, job.id, `result-stripped.jpg`))
    expect(existsSync(record!.resultPath!)).toBe(true)
    expect(hasAiMarkers(readFileSync(record!.resultPath!))).toBe(false)

    const photos = calls.filter((c) => c.method === `sendPhoto`)
    expect(photos.length).toBe(1)
    expect(photos[0]!.args[0]).toBe(42)
    const edits = calls.filter((c) => c.method === `editMessageText`)
    expect(edits.length).toBeGreaterThanOrEqual(6)
    expect(String(edits[edits.length - 1]!.args[2])).toContain(`Polish done`)
    expect(edits.every((c) => c.args[1] === 7)).toBe(true)
  })

  it(`an empty queue processes nothing`, async () => {
    const worker = new WorkerLoop(db, fakeApi, mockCfg())
    expect(await worker.processOne()).toBeUndefined()
    expect(calls.length).toBe(0)
  })
})

describe(`WorkerLoop live-mode failure (login wall)`, () => {
  it(`marks the job failed with login-needed and edits the ACK honestly`, async () => {
    const cfg = {...mockCfg(), mockAi: false}
    const input = await saveMockPhoto(join(jobsDir, `pending`), `input.png`)
    const job = await db.jobs.enqueue({
      userId: 43,
      chatId: 43,
      photoPath: input,
      promptId: `upscale-colorize`,
      promptText: `upscale it`,
      promptName: `4K Upscale + Colorize`,
    })
    await db.jobs.update(job.id, {ackMessageId: 8})
    const stubMoli = {
      ensureBrowser: async () => ({}) as never,
      ensurePage: async () => ({}) as never,
      stop: async () => {},
    }
    const worker = new WorkerLoop(db, fakeApi, cfg, {
      moli: stubMoli as never,
      runPolishFn: (async () => {
        throw new GeminiError(`login-needed`, `Gemini shows a login wall`)
      }) as never,
    })
    await worker.processOne()
    const record = db.jobs.find(job.id)
    expect(record?.status).toBe(`failed`)
    expect(record?.errorCode).toBe(`login-needed`)
    expect(calls.some((c) => c.method === `sendPhoto`)).toBe(false)
    const edits = calls.filter((c) => c.method === `editMessageText`)
    expect(edits.length).toBe(1)
    expect(String(edits[0]!.args[2])).toContain(`log in once`)
  })
})
