import type {LmdbEnvSub} from "@gramstax/lmdb"
import type {PromptId} from "~/lib/prompts"
import type {IUserProfile} from "~/types/user"
import type {UserSchema, IVUser} from "../schema/user"

/** Max recent job ids kept per user (for /status). */
export const RECENT_JOBS_MAX = 5

export type PromptState = `idle` | `awaiting-custom`

export class UserRepository {
  constructor(private readonly _user: LmdbEnvSub<typeof UserSchema>) {}

  /**
   * Insert once, keyed by Telegram id.
   *
   * `putIfNotExists` reports whether *this* call won the write, so the loser
   * path reads the row back. Returning the object we just failed to write would
   * hand callers a row that was never stored.
   */
  async createIfNotExists(tgId: number, data: IUserProfile): Promise<{user: IVUser; created: boolean}> {
    const fresh = {...data, updatedAt: new Date()} as IVUser
    const created = await this._user.putIfNotExists(tgId, fresh)
    if (created) return {user: fresh, created}
    return {user: this._user.get(tgId) ?? fresh, created}
  }

  /**
   * Bump `updatedAt` on an existing row.
   *
   * Read-then-write, so it runs inside a transaction — without one a concurrent
   * writer can land between the read and the write and get silently clobbered.
   */
  async touch(tgId: number): Promise<boolean> {
    return this._user.owner.transaction(() => {
      const row = this._user.get(tgId)
      if (!row) return false
      this._user.putSync(tgId, {...row, updatedAt: new Date()})
      return true
    })
  }

  /** Sync read — LMDB point lookups are synchronous, no promise needed. */
  find(tgId: number): IVUser | undefined {
    return this._user.get(tgId)
  }

  /**
   * Rewrite a profile WITHOUT botLang — repair for legacy rows whose
   * positional fields shifted (botLang read back as a non-string because
   * the row was written before that field existed). The row is rewritten
   * with the current schema, so later reads are correct.
   */
  async rewriteProfile(tgId: number, profile: IUserProfile): Promise<void> {
    await this._user.put(tgId, {...profile, updatedAt: new Date()} as IVUser)
  }

  /**
   * Save the bot language preference ("en" | "id"); the row is created
   * when it does not exist yet.
   *
   * Read-then-write, so it runs inside a transaction like `touch` —
   * lmdb-best-practices (txn-transactions): get-then-put without a
   * transaction is a race, an interleaving writer can be silently
   * clobbered. The type narrows to the enum union, not a wide string.
   */
  async setBotLang(tgId: number, botLang: `en` | `id`, profile: IUserProfile): Promise<void> {
    // transaction() returns a Promise — it MUST be awaited, otherwise an
    // error (e.g. an enum rejection) becomes an unhandled rejection and
    // the caller believes the write committed when it did not.
    await this._user.owner.transaction(() => {
      const row = this._user.get(tgId)
      if (row) {
        this._user.putSync(tgId, {...row, botLang, updatedAt: new Date()})
        return
      }
      this._user.putSync(tgId, {...profile, botLang, updatedAt: new Date()} as IVUser)
    })
  }

  /** Prompt preference: selected preset + saved custom text + typing state. */
  promptPref(tgId: number): {promptId: PromptId; customPrompt: string; promptState: PromptState} {
    const row = this._user.get(tgId)
    const promptId = row?.promptId ?? `upscale-colorize`
    return {
      promptId,
      customPrompt: row?.customPrompt ?? ``,
      promptState: row?.promptState ?? `idle`,
    }
  }

  /** Save the selected prompt preset (created row when missing). */
  async setPromptId(tgId: number, promptId: PromptId, profile: IUserProfile): Promise<void> {
    await this.updateRow(tgId, profile, (row) => ({...row, promptId}))
  }

  /** Save the user's custom prompt text. */
  async setCustomPrompt(tgId: number, customPrompt: string, profile: IUserProfile): Promise<void> {
    await this.updateRow(tgId, profile, (row) => ({...row, customPrompt}))
  }

  /** Mark whether /prompts is waiting for the user to type a custom prompt. */
  async setPromptState(tgId: number, promptState: PromptState, profile: IUserProfile): Promise<void> {
    await this.updateRow(tgId, profile, (row) => ({...row, promptState}))
  }

  /** Recent job ids for /status (JSON array, newest first, max 5). */
  recentJobIds(tgId: number): string[] {
    const row = this._user.get(tgId)
    if (!row?.recentJobsJson) return []
    try {
      const parsed = JSON.parse(row.recentJobsJson) as unknown
      return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === `string`) : []
    } catch {
      return []
    }
  }

  /** Prepend a job id to the user's recent list, keeping only the newest 5. */
  async addRecentJob(tgId: number, jobId: string, profile: IUserProfile): Promise<void> {
    await this.updateRow(tgId, profile, (row) => {
      const kept = [jobId, ...this.recentJobIds(tgId)].filter((id, i, arr) => arr.indexOf(id) === i).slice(0, RECENT_JOBS_MAX)
      return {...row, recentJobsJson: JSON.stringify(kept)}
    })
  }

  /** Clear the user's job history + custom prompt (used by /forget). */
  async clearPolishData(tgId: number): Promise<void> {
    await this._user.owner.transaction(() => {
      const row = this._user.get(tgId)
      if (!row) return
      this._user.putSync(tgId, {...row, recentJobsJson: JSON.stringify([]), customPrompt: ``, updatedAt: new Date()})
    })
  }

  private async updateRow(tgId: number, profile: IUserProfile, patch: (row: IVUser) => IVUser): Promise<void> {
    await this._user.owner.transaction(() => {
      const row = this._user.get(tgId)
      if (row) {
        this._user.putSync(tgId, {...patch(row), updatedAt: new Date()})
        return
      }
      this._user.putSync(tgId, {...patch({...profile, updatedAt: new Date()} as IVUser), updatedAt: new Date()})
    })
  }

  /** Total stored users — O(1) via `mdb_stat`, safe on a hot path. */
  count(): number {
    return this._user.count()
  }

  displayName(tgId: number): string {
    const row = this._user.get(tgId)
    if (!row) return `User#${tgId}`
    return row.firstName || row.username || `User#${tgId}`
  }
}
