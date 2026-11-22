# AGENTS.md

## STRICT RECREATE RULES (Damar, 2026-11-19 — apply to this project AND every
## future Gramstax bot project, no exceptions)

1. **English only in repo content**: repo description + README.md in
   English; README follows the `create-gramstax` 6.1.0 template style
   (title + badges, Features, Quick Start, Scripts table, Project
   Structure, Configuration, Testing, Deployment, Tech Stack, License).
2. **No `references/` here**: this is NOT an n8n recreate — there is
   no original workflow JSON. Do NOT name n8n in the repo description,
   `package.json` description, or main README.md.
3. **README.md MUST contain a Mermaid flowchart** of this project's
   own code flow.
4. **Repo description MUST start with 1 emoji**, English. The bot is
   multilingual — NEVER "plain English" only: say "English or
   Indonesian", and the README intro + start/help templates must say
   the same.
5. **Bilingual, English by default**: every user-facing message is
   English by default AND Indonesian. Language is stored per user in
   LMDB (`UserSchema.botLang`), changed with `/language`; follow
   `gramstax-best-practices` and `lmdb-best-practices` (6.1.0).
6. **Commands are ENGLISH ONLY (Damar, 2026-11-19 ~15:22 WIB).** There
   is NO `intentCommandText` in any page's `buildData()`:
   `static data = this.buildData()` (or with a callback-args function
   where the page has one), and the command is the page name:
   `/polish`, `/prompts`, `/status`, `/language`, `/forget` (+ `/start`,
   `/help`). Message CONTENT is still bilingual (rule 5/7) — an
   English command does NOT make the replies English-only.

   6a. **Localization is done ONLY with static template blocks**
   (`<g-message>`, `<g-message lang="id">`, `<g-switch>`,
   `<g-map>`, `<g-ifelse>`); user-facing messages live in the
   template, dynamic data is passed as template variables.
   **`src/lib/i18n.ts` is FORBIDDEN** (Damar, 2026-11-19 ~14:43 WIB)
   — it is useless. The only language helper allowed is
   `src/lib/lang.ts` (resolves the language code `en`|`id`, no
   messages). Documented exceptions, all non-user-facing: the
   dynamic progress/status strings in `src/lib/progress.ts`
   (percent + stage text cannot be a static template — the ACK is
   EDITED with new text on every stage; both languages are kept
   side by side in one file, no third language path).
   6b. **`<g-description>` is PER PAGE** (confirmed by Damar
   2026-11-19 ~15:22 WIB): the sync reads
   `getGDescription("<page-name>", "default", lang, scope)`, so a
   description placed in `start/index.ts` would only ever sync
   `/start`. EVERY page with a command handler
   (`handleCommandText` / `handleCommandArgsText`) carries its own
   `<g-description>` block in its template's default `<g-base>`,
   in EN (default) + `lang="id"`. Pages without a command handler
   (`status.ts` — the Route Not Found page) carry none. Command
   pages here: start, polish, prompts, status, help, language,
   forget — 7 commands, 2 languages each.
   6c. **Keyboard is written ONCE** in `src/blocks/g-keyboard.ts`
   (`KeyboardGBlock.mainMenu()`, `promptPicker()`,
   `languagePicker()`), with `{default, id}` labels; the framework
   `_build` emits both variants. Pages reuse it — never duplicate
   the keyboard per page.
   6d. **Mermaid in README: plain words only in node labels**
   (Damar, 2026-11-19 ~16:30 WIB — found in the DB Chat repo,
   verified on the live GitHub page). The local Mermaid parser v11
   can print PARSE OK while GitHub's renderer FAILS: the DB Chat
   diagram errored on GitHub with `Parse error ... Expecting 'SQE'
   ... got 'STR'` because a node contained `=` and nested quotes
   (`PAGES["... lang='id'"]`). NEVER put `=` or nested quotes
   inside a Mermaid node label — write plain words only (e.g.
   `template EN and ID`). Validate locally with
   `/tmp/mmd-parse/parse-both.ts` (must print PARSE OK), AND the
   final verification MUST be viewing the rendered diagram on the
   GitHub README page in the browser — local parse alone is NOT
   proof. Also recorded in `~/workspace/recreate-rules.md` §6d.
7. **No emoji in `##` README headings** (the "emoji on parent
   headings" rule was REVOKED by Damar 2026-11-19 ~14:40 WIB).
   Emoji is still fine in the repo DESCRIPTION (rule 4) and inside
   list items / body text.
8. **Repo name represents the project** (`bot-polish-image-4k`).
   Get the name right at creation — do NOT rename a published repo
   (renaming breaks its URL). Repo is PUBLIC. Description has NO
   ecosystem version number. README is firm, human, and clear.
   Promo for the Telegram-bot creation service by a Gramstax
   engineer sits at the TOP of every README.md (under title +
   badges, before Features, English, linking Telegram
   @damartripamungkas).
9. **Conventional commits + scope** (e.g. `feat(pages): ...`,
   `fix(gemini): ...`, `chore(repo): ...`). Every project MUST
   have `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `SECURITY.md`.
   Every repo MUST have topics for SEO.
10. **Page file names in English only** (e.g. `polish.ts`,
    `prompts.ts`, `status.ts`, `forget.ts`, `language.ts` — never an
    Indonesian spelling).
11. **No sibling job words**: this bot POLISHES images to 4K — it
    does not do the sibling bot's job. The sibling's job words (its
    verb, its page kind, its fetch module, its AI provider — the
    four stems in the audit grep below) must NOT appear anywhere in
    this repo. Audit with
    `grep -rni "summar|latest|openai|scraper" .` (excluding
    `node_modules`, `data*`, `.gramstax`, `jobs*`, and this file —
    which is where the pattern itself lives) = 0 before every push.
    The same rule applies to `package.json` description,
    `.env.example`, and every page template.
12. **ALWAYS check the Mermaid flow in README.md** (Damar,
    2026-11-19 ~16:13 WIB): render/validate until 0 errors before
    commit/push. See rule 6d for the GitHub-vs-local trap.
13. **Everything Damar asks for is recorded in .md AND committed**
    (Damar, 2026-11-21 ~16:00 WIB): always commit, no exceptions.
    One fact = one canonical .md file; other files only reference
    it (anti-duplication rule, 2026-11-21 ~16:04 WIB).

## Project rules — bot-polish-image-4k (Damar, 2026-11-22)

- **Flow**: Telegram photo → ACK immediately (queue position +
  prompt name) → worker polishes via Gemini web in a Moli browser
  → result photo back, ACK edited with progress percents along the
  way. Stages: queued 5%, browser ready 15%, uploaded 25%, prompt
  sent 40%, generating 60%, downloading 85%, done 100%.
- **Moli**: the bot spawns `moli serve --layout -p <port> -P
  <profile-dir> --log-level error --http-proxy "$HTTP_PROXY"` and
  drives it via Playwright-core `connectOverCDP`. The
  `--http-proxy` flag is MANDATORY — moli ignores the proxy env
  vars and egress to Google fails without it (probe 2026-11-22).
  Moli auto-restarts if the CDP connection drops.
- **Gemini session rule (Damar, 2026-11-22)**: ONE Gemini chat
  session for up to 50 polish requests; the 51st starts a new chat
  and resets the counter to 1. Chat URL + request count persist in
  LMDB (`gemini-session` row). If the saved chat URL fails to load,
  create a new chat once and continue. This refines the 2026-11-21
  "same session" rule from restored-content-factory.
- **Prompt presets**: (1) "4K Upscale + Colorize" = the VERBATIM
  prompt from `restored-content-factory/polish-gemini-web/4K
  Upscale and Detail Enhancement.md` (default, includes the final
  colorize sentence); (2) "4K Upscale only" = same prompt WITHOUT
  the colorize sentence; (3) custom prompt typed by the user,
  stored per user in LMDB. The chosen text is pasted verbatim into
  Gemini every request. A photo caption is a one-off custom prompt
  for that job only.
- **Queue**: sequential FIFO in LMDB, one polish at a time (single
  Gemini session). The worker is in-process — no sidecar, no second
  LMDB opener.
- **Metadata strip (same rule as restored-content-factory)**: the
  result image is re-encoded (sharp, JPEG q95 / PNG, never
  `withMetadata()`) and byte-scanned for C2PA / SynthID / XMP /
  JUMBF markers BEFORE it is sent. If markers survive, the job
  fails — a result is never sent unstripped.
- **Login handling**: the worker detects the Gemini login wall
  (Sign in button / login URL) and fails the job HONESTLY
  ("Gemini login needed — ask the owner to log in once") instead of
  hanging or faking a result. The WORKER never logs in and never
  touches a password. One-time login is done by the OWNER with Moli
  + JS directly (Damar, 2026-11-22 — NOT via chrome://inspect):
  `scripts/moli-login.mjs` (`bun run login:moli`) drives the Google
  sign-in form in Moli via Playwright/CDP; the owner types the
  email/password in the terminal (masked, never logged/stored) and
  completes 2FA (phone approval or TOTP code); the script verifies
  the login on gemini.google.com, then stops Moli so cookies flush
  to the profile dir. Zip that profile dir and place it at
  `./moli-profile` on the bot host (see README).
- **Mock mode**: `POLISH_MOCK_AI=1` — the worker returns a
  deterministic copy of the input image as the "polished" result.
  All e2e tests run in mock mode. Mock is ONLY on when the env var
  is `1`; there is no API fallback.
- **Unproven selectors**: the upload-menu item text, send-button
  selector, and download-button selector are UNPROVEN until a
  logged-in Gemini session exists (the probe only saw the logged-out
  UI). `src/lib/gemini.ts` has fallbacks and marks each as such —
  the first live run MUST update `gemini.ts` (and PANDUAN.md) with
  what was actually seen.
- **Photos are never committed**: user photos live in `jobs/`
  (git-ignored), the Moli profile in `moli-profile/`
  (git-ignored).

## Project notes — bot-polish-image-4k (2026-11-22)

Structure (Gramstax 6.1.0 + Bun + @gramstax/lmdb, no HTTP server):

- `src/lib/config.ts` — `POLISH_*` env (`POLISH_MOCK_AI`,
  `POLISH_ALLOWED_IDS`, `POLISH_JOBS_DIR` default `./jobs`,
  `MOLI_BIN` default `~/.local/bin/moli`, `MOLI_PROFILE_DIR`
  default `./moli-profile`, `MOLI_PORT` default 9222,
  `MOLI_PROXY` default `$HTTP_PROXY`, `GEMINI_CHAT_URL`,
  `GEMINI_BASE_URL`).
- `src/lib/prompts.ts` — presets + `SESSION_MAX_REQUESTS = 50` +
  `resolvePromptText()`.
- `src/lib/moli.ts` — `MoliManager`: spawn, wait for CDP,
  `connectOverCDP`, auto-restart, `ensurePage` reuses the first tab.
- `src/lib/gemini.ts` — `runPolish`: goto saved chat or new chat
  (one retry as new chat if the saved URL fails), login-wall check,
  upload via "+" menu → `input[type=file]`, fill prompt box verbatim
  + verify, send (button candidates, then Enter fallback), wait for
  a new `img[src*="googleusercontent"]` up to 10 min, download (hover
  download button, then `page.request.get` fallback). Typed
  `GeminiError` codes: `login-needed` / `upload-failed` /
  `generation-timeout` / `download-failed` / `browser-failed`.
  `mockPolish` copies the input and reports the same stages.
- `src/lib/strip.ts` — sharp re-encode + byte-scan for
  `c2pa`/`synthid`/`xmp`/`jumbf`/`c2pa_manifest`/XMP namespace.
- `src/lib/progress.ts` — bilingual EN/ID dynamic status texts
  (documented exception to rule 6a — see above).
- `src/lib/photos.ts` — live: `getFile` + Telegram file URL with
  `BOT_TOKEN`; mock: 1×1 white PNG fixture.
- `src/lib/worker.ts` — `WorkerLoop`: one job at a time, started
  from `BotCore.hookAfterStart`, never in e2e. Claims a session
  slot, drives Moli+Gemini or mock, strips + verifies the result,
  sends the result photo, edits the ACK. Failures mark the job
  `failed` with a code + honest ACK edit; strip failure is its own
  `failed-strip` path and the image is never sent.
- `src/db/` — `UserSchema` (prompt prefs appended at END after
  `botLang`: `promptId`, `customPrompt`, `promptState`,
  `recentJobsJson`) + `JobSchema` (userId, chatId, ackMessageId,
  photoPath, promptId/text/name, status `queued|running|done|failed`,
  percent, errorCode, resultPath, position, timestamps) +
  `JobQueueSchema` (`{jobId}` payload for `LmdbQueue`) +
  `GeminiSessionSchema` (single row key `gemini`: chatUrl,
  requestCount). ~6 of 32 maxDbs slots used.
- `src/pages/` — `polish.ts` (`/polish`: prompt, free photo →
  enqueue + immediate ACK, caption photo → one-off custom prompt,
  free text → save custom prompt when `awaiting-custom`, else
  prompt; ACK message id is stored BEFORE `enqueueId` so the
  worker never picks up a job it cannot edit), `prompts.ts`
  (`/prompts` inline-keyboard picker), `status.ts` (`/status`:
  recent jobs via `<g-map>`, queue depth, session N/50),
  `start/index.ts`, `help.ts`, `language.ts`, `forget.ts` (clears
  recent jobs + custom prompt), `error.ts` (Route Not Found, no
  `<g-description>`).
- `src/core/bot.ts` — AllowList `POLISH_ALLOWED_IDS`,
  `hookAfterStart` starts the nightly report + `WorkerLoop` with
  `this.bot.api`, `stop()` stops worker + Moli.
- `scripts/verify-moli-cdp.ts` (`bun run verify:moli`) — spawns
  moli with a scratch profile, connects via CDP, reads example.com
  title, confirms the Gemini login wall. **Verdict 2026-11-22: Bun
  CAN drive playwright-core over CDP — no Node worker needed.**
  `scripts/mock-polish-run.ts` — mock pipeline end-to-end
  (photo in → mock result out → strip verified).
- `test/` — 11 unit files (59 tests): config, prompts, moli,
  gemini, strip, progress, photos, queue, worker, lang, keyboard.
- `e2e/` — mock mode (`POLISH_MOCK_AI=1`, `DB_PATH=./data-e2e`);
  `e2e/setup.ts` `resetEnv()` clears the queue + every fixture
  user's polish data + the Gemini session row (global, persists
  across runs — must be reset for deterministic N/50) +
  `recoverInterrupted()`. Coverage ledger: `e2e/COVERAGE.md`,
  machine-checked by `scripts/check-e2e-handlers.ts`.

Verification commands: `bun run typecheck`, `bun run test:all`
(unit + e2e + mirror/coverage checks), `bun run build:gramstax`,
`bun run verify:moli`, `bun run mock:polish`. Live test (blocked
until Damar provides a BOT_TOKEN and a one-time Google login in
the Moli profile): run the bot, send a photo, watch the ACK edits
5→15→25→40→60→85→100, receive the stripped 4K result.

Git: `gh` CLI (logged in as `damartripamungkas`), HTTPS via the
`gh` credential helper — SSH push FAILS (the VM key is only a
Deploy Key for `inkred-content-factory`). Repo:
`gramstax/bot-polish-image-4k` (PUBLIC, created + pushed
2026-11-22, HEAD `ea9d5db`). Topics: ai-assistant, bun, chatbot,
gemini, gramstax, image-upscaling, moli, photo-restoration,
telegram-bot, typescript. Bot live since 2026-11-22 ~15:17 WIB as
@ke2_ai_bot (youtube-bot token, for testing).
