/**
 * Worker-facing status texts (EN + ID).
 *
 * These are DYNAMIC status lines (percent + stage + error code), not
 * static page content — they are rendered by the background worker,
 * which has no page template to render through. The sibling bots
 * document the same exception for dynamic/logic strings: they go
 * through the per-user language mechanism, default EN (see
 * recreate-rules.md §6). Static page content still lives in the page
 * templates only.
 */
import type {Lang} from "./lang"

export type JobMessageKind = `progress` | `done` | `failed-login` | `failed-timeout` | `failed-upload` | `failed-download` | `failed-browser` | `failed-strip` | `failed-interrupted` | `failed-generic`

const STAGE_LABEL: Record<string, {en: string; id: string}> = {
  queued: {en: `queued`, id: `dalam antrean`},
  "browser-ready": {en: `browser ready`, id: `browser siap`},
  uploaded: {en: `photo uploaded`, id: `foto terunggah`},
  "prompt-sent": {en: `prompt sent`, id: `prompt terkirim`},
  generating: {en: `Gemini is generating`, id: `Gemini sedang membuat`},
  downloading: {en: `downloading result`, id: `mengunduh hasil`},
  done: {en: `done`, id: `selesai`},
}

export function progressText(lang: Lang, percent: number, stage: string, position: number): string {
  const label = STAGE_LABEL[stage] ?? STAGE_LABEL.queued!
  if (lang === `id`) {
    return `✨ Polish foto — ${percent}%\n${label.id} (antrean #${position})\n\nMohon tunggu, proses polish sedang berjalan.`
  }
  return `✨ Polishing your photo — ${percent}%\n${label.en} (queue #${position})\n\nPlease wait, the polish is running.`
}

export function jobMessage(lang: Lang, kind: JobMessageKind, detail?: string): string {
  switch (kind) {
    case `done`:
      return lang === `id`
        ? `✅ Polish selesai — foto hasilmu ada di atas.`
        : `✅ Polish done — your polished photo is above.`
    case `failed-login`:
      return lang === `id`
        ? `❌ Gemini meminta login — sesi Google di browser bot sudah habis atau belum ada. Minta owner untuk login sekali di profil Moli, lalu kirim fotonya lagi.`
        : `❌ Gemini asks for a login — the bot's Google session is missing or expired. Ask the owner to log in once in the Moli profile, then send your photo again.`
    case `failed-timeout`:
      return lang === `id`
        ? `❌ Gemini tidak memberi hasil dalam batas waktu. Silakan kirim fotonya lagi.`
        : `❌ Gemini did not return a result in time. Please send your photo again.`
    case `failed-upload`:
      return lang === `id`
        ? `❌ Foto gagal diunggah ke Gemini. Silakan kirim fotonya lagi.`
        : `❌ The photo failed to upload to Gemini. Please send your photo again.`
    case `failed-download`:
      return lang === `id`
        ? `❌ Hasil polish tidak bisa diunduh dari Gemini. Silakan kirim fotonya lagi.`
        : `❌ The polished result could not be downloaded from Gemini. Please send your photo again.`
    case `failed-browser`:
      return lang === `id`
        ? `❌ Browser bot gagal dibuka. Silakan kirim fotonya lagi sebentar lagi.`
        : `❌ The bot browser failed to start. Please send your photo again in a moment.`
    case `failed-strip`:
      return lang === `id`
        ? `❌ Hasil polish gagal dibersihkan dari metadata AI. Silakan kirim fotonya lagi.`
        : `❌ The polished result failed the metadata check. Please send your photo again.`
    case `failed-interrupted`:
      return lang === `id`
        ? `❌ Polish terhenti karena bot restart. Silakan kirim fotonya lagi.`
        : `❌ The polish was interrupted by a bot restart. Please send your photo again.`
    default:
      return lang === `id`
        ? `❌ Polish gagal${detail !== undefined ? ` (${detail})` : ``}. Silakan kirim fotonya lagi.`
        : `❌ The polish failed${detail !== undefined ? ` (${detail})` : ``}. Please send your photo again.`
  }
}
