import type {LmdbEnvSub} from "@gramstax/lmdb"
import {SESSION_MAX_REQUESTS} from "~/lib/prompts"
import {SESSION_KEY, type IVSession, type SessionSchema} from "../schema/session"

export interface INextRequest {
  /** Chat URL to open (`""` = start a new chat). */
  chatUrl: string
  /** Request number inside this chat (1–50). */
  requestCount: number
  /** True when the worker must open a NEW chat for this request. */
  isNewChat: boolean
}

export class SessionRepository {
  constructor(private readonly _session: LmdbEnvSub<typeof SessionSchema>) {}

  /** Sync read of the single session row (undefined = no chat yet). */
  find(): IVSession | undefined {
    return this._session.get(SESSION_KEY)
  }

  /**
   * Claim the next request slot in the current Gemini chat.
   *
   * Session rule (Damar 2026-11-22): one chat for up to 50 requests.
   * When there is no chat yet, or the counter already hit 50, the
   * worker starts a NEW chat and the counter resets to 1.
   */
  async nextRequest(): Promise<INextRequest> {
    return this._session.owner.transaction(() => {
      const row = this._session.get(SESSION_KEY)
      if (!row || row.requestCount >= SESSION_MAX_REQUESTS) {
        const fresh = {chatUrl: ``, requestCount: 1, updatedAt: new Date()} as IVSession
        this._session.putSync(SESSION_KEY, fresh)
        return {chatUrl: ``, requestCount: 1, isNewChat: true}
      }
      const next = {...row, requestCount: row.requestCount + 1, updatedAt: new Date()}
      this._session.putSync(SESSION_KEY, next)
      return {chatUrl: row.chatUrl, requestCount: next.requestCount, isNewChat: false}
    })
  }

  /** Persist the chat URL after a successful polish (same chat continues). */
  async setChatUrl(chatUrl: string): Promise<void> {
    await this._session.owner.transaction(() => {
      const row = this._session.get(SESSION_KEY)
      if (!row) return
      this._session.putSync(SESSION_KEY, {...row, chatUrl, updatedAt: new Date()})
    })
  }

  /** Forget the saved chat (used when the chat URL fails to load twice). */
  async reset(): Promise<void> {
    await this._session.owner.transaction(() => {
      this._session.putSync(SESSION_KEY, {chatUrl: ``, requestCount: 0, updatedAt: new Date()} as IVSession)
    })
  }
}
