import {join} from "node:path"
import {TemplateManager} from "gramstax"
import {BotCore} from "../src/core/bot"

// E2E env — REQUIRED before `new BotCore` (BotCore's `db` field reads
// DB_PATH at construction). Mock polish is on so no browser, no Gemini,
// and no Google login are needed: the worker path is not started in
// e2e at all (deploy: "test" never calls start), and photo intake
// writes the fixture PNG instead of downloading from Telegram.
process.env.DB_PATH = `./data-e2e`
process.env.POLISH_MOCK_AI = `1`
process.env.POLISH_ALLOWED_IDS = ``
process.env.POLISH_JOBS_DIR = `./jobs-e2e`

export type {IE2eApiCall, IE2eUpdateOptions} from "gramstax"

export const bot = new BotCore({
  deploy: `test`,
  token: `test`,
  log: false,
  autoRetry: true,
  templateManager: new TemplateManager({
    path: [join(import.meta.dir, `../src/pages`)],
  }),
})
export const e2e = bot.e2e!

// One UNIQUE user.id block per test file — the bot instance + session
// store live in module scope and are shared by every file in one run
// (skill e2e-setup). A fixture without a username deliberately tests
// the bot without a username guard.
export const startUser = {user: {id: 9001, username: `poluser`, language_code: `id`}}
export const startEnUser = {user: {id: 9002, username: `polen`, language_code: `en`}}
export const helpUser = {user: {id: 4601, username: `helpuser`, language_code: `id`}}
export const helpEnUser = {user: {id: 4602, username: `helpen`, language_code: `en`}}
export const polishUser = {user: {id: 4401, username: `polishuser`, language_code: `id`}}
export const polishEnUser = {user: {id: 4402, username: `polishen`, language_code: `en`}}
export const promptsUser = {user: {id: 4403, username: `promptsuser`, language_code: `id`}}
export const promptsEnUser = {user: {id: 4404, username: `promptsen`, language_code: `en`}}
export const statusUser = {user: {id: 4405, username: `statususer`, language_code: `id`}}
export const forgetUser = {user: {id: 4901, username: `forgetuser`, language_code: `id`}}
export const languageUser = {user: {id: 4902, username: `languser`, language_code: `en`}}
export const languageDefaultUser = {user: {id: 4903, username: `langdefault`, language_code: `en`}}
export const errorUser = {user: {id: 4951, username: `erroruser`, language_code: `id`}}
export const coverageUser = {user: {id: 4952, username: `coverageuser`, language_code: `id`}}
export const deniedUser = {user: {id: 4999, username: `denieduser`, language_code: `id`}}
export const noUsernameUser = {user: {id: 4202, language_code: `id`}}
export const dbUser = {user: {id: 4101, username: `dbuser`, language_code: `id`}}

const FIXTURE_IDS = [9001, 9002, 4601, 4602, 4401, 4402, 4403, 4404, 4405, 4901, 4902, 4903, 4951, 4952, 4999, 4202, 4101]

/** Clear persistent fixture state (recent jobs, prompt prefs) per test. */
export async function resetEnv(): Promise<void> {
  await bot.db.jobs.clearQueue()
  await bot.db.jobs.recoverInterrupted()
  for (const id of FIXTURE_IDS) {
    await bot.db.user.clearPolishData(id)
    // clearPolishData keeps the chosen preset (production /forget
    // semantics) — tests need a deterministic default preset + idle
    // state, so reset both here. No-op on first run (no row yet).
    await bot.db.user.setPromptId(id, `upscale-colorize`, {username: ``, firstName: ``})
    await bot.db.user.setPromptState(id, `idle`, {username: ``, firstName: ``})
  }
  // The Gemini session row is global (not per-user) and persists in
  // data-e2e across runs — reset it so /status N/50 is deterministic.
  await bot.db.session.reset()
}
