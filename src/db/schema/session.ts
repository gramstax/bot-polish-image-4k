import type {KeyOf, ValueOf} from "@gramstax/lmdb"
import {LmdbSchema, t} from "@gramstax/lmdb"

export type IKSession = KeyOf<typeof SessionSchema>
export type IVSession = ValueOf<typeof SessionSchema>

/**
 * Gemini session state: ONE row (key `gemini`) holding the chat URL to
 * reuse and how many polish requests already ran in it.
 *
 * Session rule (Damar 2026-11-22): one Gemini chat session for up to 50
 * polish requests; on the 51st the worker starts a new chat and resets
 * the counter to 1. This refines the 2026-11-21 "same session" rule
 * (restored-content-factory) — the session is still reused, just not
 * forever. When the saved chat URL fails to load, the worker creates a
 * new chat once and continues (the counter still counts the request).
 */
export class SessionSchema extends LmdbSchema {
  static db = `gemini-session`
  static key = t.string()

  static value = {
    /** Chat URL to reopen (`""` = no chat yet — start a new one). */
    chatUrl: t.string(),
    /** Requests already run in this chat (0–50). */
    requestCount: t.number(),
    updatedAt: t.date().$defaultFn(() => new Date()),
  }
}

/** The single session row's key. */
export const SESSION_KEY = `gemini`
