/**
 * WorkerLoop — the in-process background job loop.
 *
 * One polish at a time, sequential FIFO from the LMDB queue (a single
 * Gemini session cannot run two polishes in parallel). The loop lives
 * inside the bot process (no sidecar, no second LMDB opener) and is
 * started from BotCore.hookAfterStart; e2e never starts it.
 *
 * Per job:
 *   1. claim the next queued id, mark it `running`
 *   2. claim a Gemini session slot (≤50 requests per chat, then new chat)
 *   3. drive Moli + Gemini (or the deterministic mock in POLISH_MOCK_AI=1)
 *   4. strip C2PA/SynthID/XMP from the result and byte-scan it
 *   5. send the result photo, edit the ACK to 100% + done
 * Any failure marks the job `failed` with a machine-readable code and
 * edits the ACK with an honest message — never a fake result.
 */
import {InputFile, type Api} from "grammy"
import {mkdirSync} from "node:fs"
import {join} from "node:path"
import type {Db} from "~/db"
import {LogHe} from "~/helpers/log"
import type {AppConfigData} from "./config"
import {GeminiError, mockPolish, runPolish} from "./gemini"
import {MoliManager, moliConfigFromApp} from "./moli"
import {jobMessage, progressText, type JobMessageKind} from "./progress"
import {langOf} from "./lang"
import {stripAndVerify} from "./strip"

export interface IWorkerDeps {
  /** Test seam: replaces the live Gemini flow (mock mode uses mockPolish). */
  runPolishFn?: typeof runPolish
  /** Test seam: replaces the Moli manager (tests inject a failing stub). */
  moli?: MoliManager
}

export class WorkerLoop {
  private _running = false
  private _currentJobId: string | undefined
  private _moli: MoliManager
  private _runPolishFn: typeof runPolish

  constructor(
    private readonly db: Db,
    private readonly api: Api,
    private readonly cfg: AppConfigData,
    deps: IWorkerDeps = {},
  ) {
    this._moli = deps.moli ?? new MoliManager(moliConfigFromApp(cfg))
    this._runPolishFn = deps.runPolishFn ?? runPolish
  }

  get running(): boolean {
    return this._running
  }

  /** Start the loop (idempotent) + recover jobs interrupted by a restart. */
  async start(): Promise<void> {
    const recovered = await this.db.jobs.recoverInterrupted()
    if (recovered > 0) LogHe.warn(`[polish] recovered ${recovered} interrupted job(s) as failed`)
    if (this._running) return
    this._running = true
    void this.loop()
  }

  /** Stop after the current job finishes (the flag is checked between jobs). */
  async stop(): Promise<void> {
    this._running = false
    await this._moli.stop()
  }

  /** Process ONE queued job (used by the loop and by the mock pipeline script). */
  async processOne(): Promise<string | undefined> {
    const jobId = await this.db.jobs.dequeueJobId()
    if (jobId === undefined) return undefined
    this._currentJobId = jobId
    try {
      await this.processJob(jobId)
    } finally {
      this._currentJobId = undefined
    }
    return jobId
  }

  private async loop(): Promise<void> {
    while (this._running) {
      try {
        const jobId = await this.processOne()
        if (jobId === undefined) await new Promise((resolve) => setTimeout(resolve, 1000))
      } catch (err) {
        LogHe.errorMake(err, `WorkerLoop`, `loop`)
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }
  }

  private async processJob(jobId: string): Promise<void> {
    const job = this.db.jobs.find(jobId)
    if (job === undefined) return
    const lang = langOf({botLang: this.db.user.find(job.userId)?.botLang})
    const jobDir = join(this.cfg.jobsDir, jobId)
    mkdirSync(jobDir, {recursive: true})
    await this.db.jobs.setStatus(jobId, `running`)
    const onProgress = async (percent: number, stage: string): Promise<void> => {
      await this.db.jobs.setProgress(jobId, percent)
      await this.editAck(job, progressText(lang, percent, stage, job.position)).catch(() => {
        // A failed ACK edit must not fail the polish.
      })
    }
    try {
      const outPath = join(jobDir, `result.png`)
      const strippedPath = join(jobDir, `result-stripped.jpg`)
      if (this.cfg.mockAi) {
        await mockPolish(job.photoPath, outPath, async ({percent, stage}) => onProgress(percent, stage))
      } else {
        const session = await this.db.session.nextRequest()
        const browser = await this._moli.ensureBrowser()
        const page = await this._moli.ensurePage(browser)
        const result = await this._runPolishFn({
          page,
          baseUrl: this.cfg.geminiBaseUrl,
          chatUrl: session.chatUrl,
          photoPath: job.photoPath,
          promptText: job.promptText,
          outPath,
          onProgress: async ({percent, stage}) => onProgress(percent, stage),
        })
        // Persist the chat URL for the next requests in this session.
        // A new chat's URL only exists after the first polish lands.
        if (result.chatUrl !== `` && result.chatUrl !== session.chatUrl) {
          await this.db.session.setChatUrl(result.chatUrl)
        }
      }
      // Strip AI metadata from the result and PROVE it is gone before sending.
      // A strip failure is its own failure kind — the image is never sent.
      try {
        await stripAndVerify(outPath, strippedPath)
      } catch (err) {
        await this.db.jobs.update(jobId, {status: `failed`, errorCode: `strip-failed`})
        await this.editAck(job, jobMessage(lang, `failed-strip`))
        LogHe.errorMake(err, `WorkerLoop`, `strip:${jobId}`)
        return
      }
      await this.db.jobs.update(jobId, {status: `done`, percent: 100, resultPath: strippedPath})
      await this.editAck(job, jobMessage(lang, `done`))
      await this.api.sendPhoto(job.chatId, new InputFile(strippedPath))
      LogHe.info(`[polish] job ${jobId} done for user ${job.userId}`)
    } catch (err) {
      const code = err instanceof GeminiError ? err.code : `browser-failed`
      const kind: JobMessageKind =
        code === `login-needed`
          ? `failed-login`
          : code === `generation-timeout`
            ? `failed-timeout`
            : code === `upload-failed`
              ? `failed-upload`
              : code === `download-failed`
                ? `failed-download`
                : `failed-browser`
      await this.db.jobs.update(jobId, {status: `failed`, errorCode: code})
      await this.editAck(job, jobMessage(lang, kind, code))
      LogHe.errorMake(err, `WorkerLoop`, `processJob:${jobId}`)
    }
  }

  private async editAck(job: {chatId: number; ackMessageId?: number}, text: string): Promise<void> {
    if (job.ackMessageId === undefined) return
    await this.api.editMessageText(job.chatId, job.ackMessageId, text)
  }
}
