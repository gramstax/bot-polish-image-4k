import type {LmdbEnvSub, LmdbQueue} from "@gramstax/lmdb"
import type {PromptId} from "~/lib/prompts"
import type {IVJob, JobQueueSchema, JobSchema, JobStatus} from "../schema/job"

export interface IJobDraft {
  userId: number
  chatId: number
  photoPath: string
  promptId: PromptId
  promptText: string
  promptName: string
}

export interface IJobPatch {
  ackMessageId?: number
  status?: JobStatus
  percent?: number
  errorCode?: string
  resultPath?: string
}

export function newJobId(): string {
  return `job-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`
}

export class JobRepository {
  constructor(
    private readonly _jobs: LmdbEnvSub<typeof JobSchema>,
    private readonly _queue: LmdbQueue<typeof JobQueueSchema>,
  ) {}

  /** Queue depth (jobs waiting, not counting the one running). */
  queueSize(): number {
    return this._queue.size()
  }

  /** Head of the queue without removing it. */
  peekQueued(): {jobId: string} | undefined {
    const head = this._queue.peek()
    return head === undefined ? undefined : head[1]
  }

  /**
   * Create a job record WITHOUT queueing it yet. The page uses this so
   * it can send the ACK message first and store the ACK message id on
   * the record — only then does it call `enqueueId`, so the worker
   * never picks up a job whose ACK it cannot edit.
   */
  async create(draft: IJobDraft): Promise<IVJob & {id: string}> {
    const id = newJobId()
    const position = this._queue.size() + 1
    const record = {
      id,
      ...draft,
      status: `queued`,
      percent: 5,
      position,
      createdAt: new Date(),
    } as IVJob & {id: string}
    await this._jobs.put(id, record)
    return record
  }

  /** Push an existing job id onto the FIFO. */
  async enqueueId(id: string): Promise<void> {
    try {
      await this._queue.enqueue({jobId: id})
    } catch (err) {
      await this.setStatus(id, `failed`, `browser-failed`)
      throw err
    }
  }

  /** Create + enqueue in one call (used by tests and scripts). */
  async enqueue(draft: IJobDraft): Promise<IVJob & {id: string}> {
    const record = await this.create(draft)
    await this.enqueueId(record.id)
    return record
  }

  /** Take the next job id off the FIFO (undefined when empty). */
  async dequeueJobId(): Promise<string | undefined> {
    const next = await this._queue.dequeue()
    return next === undefined ? undefined : next[1].jobId
  }

  /** Sync read — LMDB point lookups are synchronous, no promise needed. */
  find(id: string): (IVJob & {id: string}) | undefined {
    const row = this._jobs.get(id)
    return row === undefined ? undefined : {...row, id}
  }

  listByIds(ids: string[]): (IVJob & {id: string})[] {
    const out: (IVJob & {id: string})[] = []
    for (const id of ids) {
      const row = this.find(id)
      if (row !== undefined) out.push(row)
    }
    return out
  }

  /** Patch a job record (read-then-write in a transaction). */
  async update(id: string, patch: IJobPatch): Promise<boolean> {
    return this._jobs.owner.transaction(() => {
      const row = this._jobs.get(id)
      if (!row) return false
      this._jobs.putSync(id, {...row, ...patch, updatedAt: new Date()})
      return true
    })
  }

  async setStatus(id: string, status: JobStatus, errorCode?: string): Promise<boolean> {
    return this.update(id, {status, ...(errorCode !== undefined ? {errorCode} : {})})
  }

  async setProgress(id: string, percent: number): Promise<boolean> {
    return this.update(id, {percent})
  }

  /**
   * Crash recovery (run on boot): jobs still `running` when the process
   * died never finished — mark them `failed` with code `interrupted`
   * instead of leaving them stuck at an old percent forever. Returns
   * how many were recovered. Uses the sync key cursor inside one
   * transaction (lmdb-best-practices txn-queue / query-range-scans).
   */
  async recoverInterrupted(): Promise<number> {
    return this._jobs.owner.transaction(() => {
      let recovered = 0
      for (const key of this._jobs.getKeys()) {
        const row = this._jobs.get(key)
        if (row?.status === `running`) {
          this._jobs.putSync(key, {...row, status: `failed`, errorCode: `interrupted`, updatedAt: new Date()})
          recovered++
        }
      }
      return recovered
    })
  }

  async clearQueue(): Promise<void> {
    await this._queue.clear()
  }
}
