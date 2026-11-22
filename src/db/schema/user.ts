import type {KeyOf, ValueOf} from "@gramstax/lmdb"
import {LmdbSchema, t} from "@gramstax/lmdb"

export type IKUser = KeyOf<typeof UserSchema>
export type IVUser = ValueOf<typeof UserSchema>

export class UserSchema extends LmdbSchema {
  static db = `user`

  // The primary key already carries the Telegram id, so there is deliberately
  // no `tgId` column — a mirrored copy would store every id twice and let the
  // two drift apart.
  static key = t.number()

  static value = {
    username: t.string(),
    firstName: t.string(),
    // Telegram omits these often, so they stay optional instead of becoming
    // empty strings — "no last name" is not the same as a last name of "".
    lastName: t.string().optional(),
    languageCode: t.string().optional(),
    // Filled at write time when the caller omits it, so no call site has to
    // pass a timestamp.
    createdAt: t.date().$defaultFn(() => new Date()),
    // Maintained by the repository on update, hence optional.
    updatedAt: t.date().optional(),
    // Bot language chosen via /language ("en" | "id").
    // lmdb-best-practices (schema-enum): a closed value set is declared
    // as an enum, not a wide string — out-of-set writes are rejected by
    // LmdbError on the write path instead of rotting silently until read.
    // Validation only happens on write, so legacy rows still read and
    // can be repaired by the hook.
    // HARD WARNING: LMDB encoding is positional — a new field MUST
    // always be appended at the END, never inserted in the middle.
    botLang: t.enum(`en`, `id`).optional(),
    // Selected prompt preset (default `upscale-colorize` when unset).
    promptId: t.enum(`upscale-colorize`, `upscale-only`, `custom`).optional(),
    // The user's own prompt text, used when promptId is `custom`.
    customPrompt: t.string().optional(),
    // `awaiting-custom` while /prompts waits for the user to type a
    // custom prompt; `idle` otherwise.
    promptState: t.enum(`idle`, `awaiting-custom`).optional(),
    // Last 5 job ids for this user (JSON array, newest first) — /status
    // reads job records through these ids.
    recentJobsJson: t.string().optional(),
  }
}