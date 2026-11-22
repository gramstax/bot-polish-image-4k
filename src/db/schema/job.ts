import type {KeyOf, ValueOf} from "@gramstax/lmdb"
import {LmdbSchema, t} from "@gramstax/lmdb"

export type IKJob = KeyOf<typeof JobSchema>
export type IVJob = ValueOf<typeof JobSchema>
export type IKJobQueue = KeyOf<typeof JobQueueSchema>
export type IVJobQueue = ValueOf<typeof JobQueueSchema>

export type JobStatus = `queued` | `running` | `done` | `failed`

/**
 * Job record: one row per polish job, keyed by the job id the worker
 * generated at enqueue time. The ACK message id is stored here so the
 * worker can EDIT the ACK with progress percents; the result path is
 * stored here so /status can show it after completion.
 */
export class JobSchema extends LmdbSchema {
  static db = `jobs`
  static key = t.string()

  static value = {
    userId: t.number(),
    chatId: t.number(),
    ackMessageId: t.number().optional(),
    photoPath: t.string(),
    promptId: t.enum(`upscale-colorize`, `upscale-only`, `custom`),
    /** Resolved prompt text at enqueue time (preset text, or the user's custom text). */
    promptText: t.string(),
    /** Display name of the prompt, for the ACK and /status. */
    promptName: t.string(),
    status: t.enum(`queued`, `running`, `done`, `failed`),
    /** Progress percent shown on the ACK (5 queued → 100 done). */
    percent: t.number(),
    /** Machine-readable failure code (login-needed, upload-failed, …). */
    errorCode: t.string().optional(),
    resultPath: t.string().optional(),
    /** Queue position at enqueue time (jobs ahead + 1). */
    position: t.number(),
    createdAt: t.date().$defaultFn(() => new Date()),
    updatedAt: t.date().optional(),
  }
}

/**
 * Queue payload for LmdbQueue — the FIFO holds job ids only; the full
 * record lives in JobSchema. One schema per queue (lmdb-best-practices
 * txn-queue): the sequence counter lives in `__queue_meta`, ids are
 * zero-padded strings, enqueue/dequeue each commit in one sync txn.
 */
export class JobQueueSchema extends LmdbSchema {
  static db = `polish-queue`
  static key = t.string()

  static value = {
    jobId: t.string(),
  }
}
