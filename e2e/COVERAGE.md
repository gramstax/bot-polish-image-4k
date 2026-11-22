# e2e Coverage Ledger — bot-polish-image-4k

How the bot is tested end-to-end. Every `handle*` the page defines needs
a row that names the test proving it; every test file needs to be
referenced. `bun run test:e2e:check` fails when either side is missing.

Conventions: commands are English-only (Damar 2026-11-19 ~15:22 WIB).
Content stays bilingual.

## Pages

| page | file | covered by | notes |
| --- | --- | --- | --- |
| start | `src/pages/start/index.ts` | `e2e/start/index.test.ts` | /start EN + ID, exact gmsg, exact keyboard labels, callback edit, navigation to Polish |
| polish | `src/pages/polish.ts` | `e2e/polish.test.ts` | /polish prompt EN + ID, photo → ACK queue #1 + prompt name (EN + ID), photo with caption → one-off custom prompt, second photo → queue #2, free text → prompt, Polish button on /start |
| prompts | `src/pages/prompts.ts` | `e2e/prompts.test.ts` | /prompts picker EN + ID, exact labels, set upscale-only saves preset, set custom → type state → free text saves custom prompt, photo uses custom text, custom with no saved text asks first (no queue) |
| status | `src/pages/status.ts` | `e2e/status.test.ts` | /status empty (0 queue, 0/50 session), lists queued job with prompt/status/percent, Status button callback, session counter 2/50 |
| language | `src/pages/language.ts` | `e2e/language.test.ts` | /language command, EN→ID and ID→EN switches, /polish renders in the new language, fresh user defaults to EN |
| forget | `src/pages/forget.ts` | `e2e/forget.test.ts` | /forget clears recent jobs + custom prompt + confirms, next photo starts a fresh history |
| error | `src/pages/error.ts` | `e2e/error.test.ts` | unknown callback → Route not found, unknown command → Route not found (EN + ID), unknown free text goes to Polish (prompt), NOT to Route not found |

## Hooks and guards

| hook | case | covered by | assertion |
| --- | --- | --- | --- |
| hookBeforeRoute (deny) | user not on POLISH_ALLOWED_IDS | `e2e/coverage.test.ts` | sendMessage penolakan ID, tanpa "aku Polish 4K" |
| hookBeforeRoute (allow) | user on POLISH_ALLOWED_IDS | `e2e/coverage.test.ts` | /start tampil "aku Polish 4K" |
| hookBeforeRoute (no username) | user without username | `e2e/coverage.test.ts` | /start tampil "aku Polish 4K" |

## Stores

| store | covered by | assertion |
| --- | --- | --- |
| user | `e2e/db-lmdb.test.ts`, `e2e/coverage.test.ts` | createIfNotExists idempotent, prompt prefs, recent jobs cap at newest 5 |
| jobs (queue + records) | `e2e/db-lmdb.test.ts`, `test/queue.test.ts` | enqueue/dequeue FIFO order, queue size, position at enqueue, recoverInterrupted marks stuck running jobs failed |
| gemini-session | `e2e/db-lmdb.test.ts`, `test/queue.test.ts` | first request starts a new chat, requests 2–50 reuse the chat, 51st starts a new chat + resets the counter |

## Descriptions (BotFather sync)

| check | covered by | assertion |
| --- | --- | --- |
| `<g-description>` per command page | `e2e/descriptions.test.ts` | `executeSyncBlocksDescription` → exactly 2 `setMyCommands` calls (default + `id`), 7 commands each, once each, exact EN/ID texts |

## Unit tests (not e2e — listed here so the ledger is complete)

| area | file | covers |
| --- | --- | --- |
| Config | `test/config.test.ts` | defaults (mock off, ./jobs, moli defaults, port 9222), env overrides, isMock matrix, parseIds |
| Prompt presets | `test/prompts.test.ts` | default preset is the verbatim prompt incl. colorize sentence, upscale-only drops only that sentence, resolvePromptText matrix, SESSION_MAX_REQUESTS = 50 |
| Moli manager | `test/moli.test.ts` | buildMoliArgs passes --http-proxy explicitly, omits it when empty, config derivation, cdpUrl |
| Gemini flow | `test/gemini.test.ts` | isLoginWall matrix, stage percents rise to 100, send-button candidates, mockPolish copies input + reports all stages in order |
| Metadata strip | `test/strip.test.ts` | hasAiMarkers (C2PA/SynthID/XMP/JUMBF), stripMetadata removes markers from a tainted JPEG, stripAndVerify happy path |
| Worker progress texts | `test/progress.test.ts` | progressText EN + ID (percent/stage/queue), jobMessage kinds bilingual + distinct |
| Photo intake | `test/photos.test.ts` | saveMockPhoto writes a fixture PNG sharp can read |
| Queue + session + prefs | `test/queue.test.ts` | FIFO order, position, peek, recoverInterrupted, 50-request rollover, prompt prefs, recent-jobs cap, clearPolishData |
| Worker loop (mock) | `test/worker.test.ts` | photo in → ACK edits with percents → stripped photo sent → record done; login-wall failure marks job failed honestly, no photo sent |
| Language resolver | `test/lang.test.ts` | langOf matrix, stored botLang wins, never crashes on non-string legacy rows |
| Keyboard | `test/keyboard.test.ts` | mainMenu + promptPicker + languagePicker labels EN + ID, single definition |

## Not covered (deliberate)

- Live Telegram delivery (needs `BOT_TOKEN` from Damar) — covered by
  the live test instead (real bot + real photo, once the token exists).
- The live Gemini browser flow (needs a logged-in Google session in the
  Moli profile — see README "One-time Google login"). Selectors for the
  upload menu, send button, and download button are UNPROVEN until the
  first logged-in run; `src/lib/gemini.ts` documents each fallback.
- Webhook deploy mode — polling is the default; webhook config is the
  standard Gramstax branch in `gramstax.config.ts`.

## Handlers

Machine-checked by `scripts/check-e2e-handlers.ts`: every `handle*`
method in `src/pages/` has a row here, and every `e2e/*.test.ts` file
is referenced by at least one row.

| Page | Handler / state | Trigger | Test | Asserts |
| --- | --- | --- | --- | --- |
| start | handleCommandText | `/start` | e2e/start/index.test.ts | sendMessage welcome + keyboard |
| start | handleCallbackQueryData | callback `start` | e2e/start/index.test.ts | editMessageText welcome + keyboard |
| polish | handleCommandText | `/polish` | e2e/polish.test.ts | prompt state |
| polish | handleCommandArgsText | `/polish <args>` | e2e/polish.test.ts | prompt state |
| polish | handleCallbackQueryData | callback `polish` | e2e/polish.test.ts | editMessageText prompt |
| polish | handleFreePhoto | photo message | e2e/polish.test.ts | ACK queue # + job queued |
| polish | handleCaptionArgsPhoto | photo with caption | e2e/polish.test.ts | caption as one-off custom prompt |
| polish | handleFreeText | free text / custom prompt | e2e/polish.test.ts | custom saved, or prompt for other text |
| prompts | handleCommandText | `/prompts` | e2e/prompts.test.ts | picker + current preset |
| prompts | handleCallbackQueryData | callback `prompts` | e2e/prompts.test.ts | picker |
| prompts | handleArgsCallbackQueryData | callback `prompts:set-*` | e2e/prompts.test.ts | preset saved / custom type state |
| status | handleCommandText | `/status` | e2e/status.test.ts | empty + job row + session counter |
| status | handleCallbackQueryData | callback `status` | e2e/status.test.ts | editMessageText status |
| help | handleCommandText | `/help` | e2e/help.test.ts | help text |
| help | handleCallbackQueryData | callback `help` | e2e/help.test.ts | editMessageText help |
| language | handleCommandText | `/language` | e2e/language.test.ts | language picker |
| language | handleCallbackQueryData | callback `language` | e2e/language.test.ts | language picker |
| language | handleArgsCallbackQueryData | callback `language:lang-xx` | e2e/language.test.ts | switch + confirmation |
| forget | handleCommandText | `/forget` | e2e/forget.test.ts | clear jobs + custom prompt |
| error | - | unknown command / callback | e2e/error.test.ts | Route not found |
| hook | - | AllowList guard | e2e/coverage.test.ts | deny / allow / no-username |
| store | - | LMDB user + jobs + session | e2e/db-lmdb.test.ts | idempotent user, FIFO queue, session counter |
| descriptions | - | g-description sync | e2e/descriptions.test.ts | 7 commands x 2 languages |
