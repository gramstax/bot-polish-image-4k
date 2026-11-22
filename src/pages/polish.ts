import {join} from "node:path"
import {PageBase} from "~/base/page"
import {AppConfig} from "~/lib/config"
import {saveMockPhoto, saveTelegramPhoto} from "~/lib/photos"
import {findPreset, resolvePromptText, type PromptId} from "~/lib/prompts"
import type {IUserProfile} from "~/types/user"

/**
 * PolishPage — /polish + photo messages: polish a photo to 4K via Gemini web.
 *
 * - handleCommandText: /polish without a photo -> prompt state.
 * - handleFreePhoto: a photo in chat -> enqueue a polish job.
 * - handleCaptionArgsPhoto: a photo WITH a caption -> the caption is a
 *   one-off custom prompt for this job only.
 * - handleFreeText: when /prompts is waiting for a custom prompt, the
 *   text is saved as the custom prompt; otherwise -> prompt state.
 * - handleCallbackQueryData: the Polish button on /start -> prompt.
 *
 * The ACK is sent IMMEDIATELY (the polish takes a while): the page
 * creates the job record, renders the ACK template (queue position +
 * prompt name), stores the ACK message id on the record, and only then
 * pushes the job onto the FIFO — the worker edits that ACK message
 * with progress percents and sends the result photo when done.
 * All words live in `static template` (EN default + `lang="id"`
 * variant). Strict rule (Damar 2026-11-19 ~14:43 WIB): no string
 * dictionary.
 */
class Base {
  static ack = `ack`
}

export class PolishPage extends PageBase {
  static data = this.buildData()

  async handleCommandText() {
    await this.gpolish.showPrompt()
  }

  async handleCommandArgsText() {
    await this.gpolish.showPrompt()
  }

  async handleCallbackQueryData() {
    await this.gpolish.showPrompt()
  }

  async handleFreePhoto() {
    await this.gpolish.enqueuePhoto(this.msg?.photo, this.msg?.caption)
  }

  async handleCaptionArgsPhoto() {
    await this.gpolish.enqueuePhoto(this.msg?.photo, this.msg?.caption)
  }

  async handleFreeText() {
    const text = this.msg?.text ?? ``
    if (!text || text.startsWith(`/`)) return
    const userId = this.from?.id
    if (userId === undefined) return
    const pref = this.db.user.promptPref(userId)
    if (pref.promptState === `awaiting-custom`) {
      await this.db.user.setCustomPrompt(userId, text.trim(), this.profile())
      await this.db.user.setPromptState(userId, `idle`, this.profile())
      await this.renderText({AGBaseId: Base.ack, data: {state: `custom-saved`, position: 0, promptName: ``}})
      return
    }
    await this.gpolish.showPrompt()
  }

  private profile(): IUserProfile {
    const from = this.from
    return {
      username: from?.username ?? ``,
      firstName: from?.first_name ?? ``,
      lastName: from?.last_name,
      languageCode: from?.language_code,
    }
  }

  helper = {
    typing: async () => {
      try {
        const chatId = this.chat?.id ?? this.from?.id
        if (chatId !== undefined) await this.api.sendChatAction(chatId, `upload_photo`)
      } catch {
        // The indicator is cosmetic — the job still goes through without it.
      }
    },
  }

  gpolish = {
    showPrompt: async () => {
      await this.renderText({data: {state: `prompt`, position: 0, promptName: ``}})
    },

    enqueuePhoto: async (photos: {file_id: string; file_size?: number}[] | undefined, caption?: string) => {
      const userId = this.from?.id
      const chatId = this.chat?.id ?? this.from?.id
      if (userId === undefined || chatId === undefined) return
      const largest = photos?.[photos.length - 1]
      if (largest === undefined) {
        await this.renderText({data: {state: `no-photo`, position: 0, promptName: ``}})
        return
      }
      await this.helper.typing()
      // Resolve the prompt: a caption overrides the preset for this job only.
      const pref = this.db.user.promptPref(userId)
      let promptId: PromptId = pref.promptId
      let promptText: string | undefined
      let promptName = findPreset(pref.promptId)?.name ?? `4K Upscale + Colorize`
      if (caption !== undefined && caption.trim() !== ``) {
        promptId = `custom`
        promptText = caption.trim()
        promptName = `Custom (caption)`
      } else {
        promptText = resolvePromptText(pref.promptId, pref.customPrompt)
      }
      if (promptText === undefined) {
        // `custom` selected but no custom prompt saved yet.
        await this.renderText({data: {state: `need-custom`, position: 0, promptName: ``}})
        return
      }
      // Fresh load (not the load-time cache): e2e sets POLISH_MOCK_AI
      // after the module is imported, so a cache would go stale.
      const cfg = AppConfig.load()
      const jobDir = join(cfg.jobsDir, `pending`)
      let photoPath: string
      try {
        photoPath = cfg.mockAi
          ? await saveMockPhoto(jobDir, `input.png`)
          : await saveTelegramPhoto(this.api, process.env.BOT_TOKEN ?? ``, largest.file_id, jobDir, `input.jpg`)
      } catch {
        await this.renderText({data: {state: `download-failed`, position: 0, promptName: ``}})
        return
      }
      // Create the record, ACK immediately, then queue (see class docs).
      const job = await this.db.jobs.create({
        userId,
        chatId,
        photoPath,
        promptId,
        promptText,
        promptName,
      })
      const sent = await this.renderText({
        AGBaseId: Base.ack,
        data: {state: `ack`, position: job.position, promptName},
      })
      const ackMessageId = extractMessageId(sent)
      if (ackMessageId !== undefined) {
        await this.db.jobs.update(job.id, {ackMessageId})
      }
      await this.db.user.addRecentJob(userId, job.id, this.profile())
      await this.db.jobs.enqueueId(job.id)
    },
  }

  static template = `
    <g-base>
      <g-description>Polish a photo to 4K</g-description>
      <g-description lang="id">Polish foto ke 4K</g-description>
      <g-message>
        <g-switch value="state">
          <g-case is="prompt"><b>🖼️ Polish a photo to 4K</b>

Send me a photo and I will polish it with AI — upscale to 4K and
enhance the details. A photo caption works as a one-off custom
prompt for that photo.

Pick your prompt first with /prompts, or send a photo now to use
the current one.</g-case>
          <g-case is="need-custom">You picked the custom prompt, but no custom prompt is saved yet. Send me your prompt text first (via /prompts → Custom prompt), then send the photo.</g-case>
          <g-case is="no-photo">I could not read a photo from that message. Send a photo (not a file) and I will polish it.</g-case>
          <g-case is="download-failed">I could not download your photo from Telegram. Please send it again.</g-case>
          <g-default>Sorry, something went wrong while I was processing your message. Please try again in a moment.</g-default>
        </g-switch>
      </g-message>
      <g-message lang="id">
        <g-switch value="state">
          <g-case is="prompt"><b>🖼️ Polish foto ke 4K</b>

Kirim foto dan aku akan memolesnya dengan AI — upscale ke 4K dan
pertajam detailnya. Caption foto bisa dipakai sebagai prompt custom
sekali pakai untuk foto itu.

Pilih prompt dulu lewat /prompts, atau langsung kirim foto untuk
memakai prompt yang sekarang.</g-case>
          <g-case is="need-custom">Kamu memilih prompt custom, tapi belum ada prompt custom yang tersimpan. Kirim dulu teks promptmu (lewat /prompts → Custom prompt), baru kirim fotonya.</g-case>
          <g-case is="no-photo">Aku tidak bisa membaca foto dari pesan itu. Kirim foto (bukan file) dan aku akan memolesnya.</g-case>
          <g-case is="download-failed">Aku tidak bisa mengunduh fotomu dari Telegram. Silakan kirim lagi.</g-case>
          <g-default>Maaf, ada yang salah saat aku memproses pesanmu. Coba lagi sebentar lagi ya.</g-default>
        </g-switch>
      </g-message>
    </g-base>

    <g-base id="${Base.ack}">
      <g-message>
        <g-switch value="state">
          <g-case is="ack">✨ Polish received — queue #{{position}}

Prompt: {{promptName}}
I will edit this message with the progress, then send your polished photo here.</g-case>
          <g-case is="custom-saved">✅ Custom prompt saved. It will be used for your next polishes. Send a photo whenever you are ready.</g-case>
          <g-default>Sorry, something went wrong while I was processing your message. Please try again in a moment.</g-default>
        </g-switch>
      </g-message>
      <g-message lang="id">
        <g-switch value="state">
          <g-case is="ack">✨ Polish diterima — antrean #{{position}}

Prompt: {{promptName}}
Aku akan mengedit pesan ini dengan progresnya, lalu mengirim foto hasil polish ke sini.</g-case>
          <g-case is="custom-saved">✅ Prompt custom tersimpan. Prompt ini akan dipakai untuk polish berikutnya. Kirim foto kapan pun kamu siap.</g-case>
          <g-default>Maaf, ada yang salah saat aku memproses pesanmu. Coba lagi sebentar lagi ya.</g-default>
        </g-switch>
      </g-message>
    </g-base>
  `
}

/** Pull the Telegram message id out of a renderText return (any shape). */
export function extractMessageId(sent: unknown): number | undefined {
  if (sent === undefined || sent === null || typeof sent !== `object`) return undefined
  if (Array.isArray(sent)) return extractMessageId(sent[0])
  const maybe = sent as {message_id?: unknown}
  return typeof maybe.message_id === `number` ? maybe.message_id : undefined
}
