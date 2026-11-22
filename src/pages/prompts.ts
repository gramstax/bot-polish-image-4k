import {PageBase} from "~/base/page"
import {findPreset, type PromptId} from "~/lib/prompts"
import {StartPage} from "./start"

/**
 * PromptsPage — /prompts: pick which prompt the worker pastes into Gemini.
 *
 * - handleCommandText / handleCallbackQueryData: show the picker with
 *   the current selection.
 * - handleArgsCallbackQueryData: `set-<preset>` saves the choice;
 *   `set-custom` also asks the user to type the custom prompt text
 *   (the next free text is captured by PolishPage.handleFreeText).
 *
 * The prompt TEXT itself lives in src/lib/prompts.ts (model-facing,
 * the documented exception to the no-dictionary rule); the page only
 * shows preset names and the saved custom text's first line.
 */
class Base {
  static done = `done`
  static typePrompt = `type`
}

export class PromptsPage extends PageBase {
  static data = this.buildData((action: string, _arg: string) => [action, _arg])

  async handleCommandText() {
    await this.gprompts.show()
  }

  async handleCallbackQueryData() {
    await this.gprompts.show()
  }

  async handleArgsCallbackQueryData() {
    const [action] = this.callbackQueryDataArgs
    await this.gprompts.process(action)
  }

  helper = {}

  gprompts = {
    show: async () => {
      const userId = this.from?.id
      const pref = userId === undefined ? undefined : this.db.user.promptPref(userId)
      const current = findPreset(pref?.promptId)?.name ?? `4K Upscale + Colorize`
      await this.renderText({
        mode: `auto`,
        keyboard: this.inlineKeyboard((k, l) => {
          k.text(l[0]!, this.data.callbackQueryData(`set-upscale-colorize`, `0`))
            .text(l[1]!, this.data.callbackQueryData(`set-upscale-only`, `0`))
            .row()
            .text(l[2]!, this.data.callbackQueryData(`set-custom`, `0`))
            .row()
            .text(l[3]!, StartPage)
          return k
        }),
        data: {current, custom: pref?.customPrompt ?? ``},
      })
    },

    process: async (action?: string) => {
      const userId = this.from?.id
      if (!action || userId === undefined) return
      const profile = {
        username: this.from?.username ?? ``,
        firstName: this.from?.first_name ?? ``,
        lastName: this.from?.last_name,
        languageCode: this.from?.language_code,
      }
      if (action === `set-custom`) {
        await this.db.user.setPromptId(userId, `custom`, profile)
        await this.db.user.setPromptState(userId, `awaiting-custom`, profile)
        await this.renderText({mode: `auto`, AGBaseId: Base.typePrompt, keyboard: this.inlineKeyboardT([StartPage], `1`, Base.typePrompt)})
        return
      }
      const promptId = action.replace(`set-`, ``) as PromptId
      const preset = findPreset(promptId)
      if (preset === undefined) return
      await this.db.user.setPromptId(userId, preset.id, profile)
      await this.db.user.setPromptState(userId, `idle`, profile)
      await this.renderCallbackAnswer({showAlert: false})
      await this.renderText({
        mode: `auto`,
        AGBaseId: Base.done,
        keyboard: this.inlineKeyboardT([StartPage], `1`, Base.done),
        data: {current: preset.name},
      })
    },
  }

  static template = `
    <g-base>
      <g-description>Choose the polish prompt</g-description>
      <g-description lang="id">Pilih prompt polish</g-description>
      ${this.kbk.promptPicker()}
      <g-message>
        <b>✨ Choose prompt</b>

        Current prompt: <b>{{current}}</b><g-ifelse>custom ? '\\nCustom prompt: ' + custom.slice(0, 120) : ''</g-ifelse>

        The worker pastes the chosen prompt into Gemini verbatim for
        every polish. "4K Upscale + Colorize" is the default (it also
        colorizes black-and-white photos); "4K Upscale only" skips the
        colorize step for photos that are already in color.
      </g-message>
      <g-message lang="id">
        <b>✨ Pilih prompt</b>

        Prompt sekarang: <b>{{current}}</b><g-ifelse>custom ? '\\nPrompt custom: ' + custom.slice(0, 120) : ''</g-ifelse>

        Worker menempel prompt yang dipilih ke Gemini apa adanya untuk
        setiap polish. "4K Upscale + Colorize" adalah default (sekaligus
        mewarnai foto hitam-putih); "4K Upscale saja" melewati langkah
        pewarnaan untuk foto yang sudah berwarna.
      </g-message>
      <g-callback-answer>Prompt saved.</g-callback-answer>
      <g-callback-answer lang="id">Prompt tersimpan.</g-callback-answer>
    </g-base>

    <g-base id="${Base.done}">
      ${this.kbk.home()}
      <g-message>
        ✅ Prompt set to <b>{{current}}</b>. Send a photo to polish it.
      </g-message>
      <g-message lang="id">
        ✅ Prompt diubah ke <b>{{current}}</b>. Kirim foto untuk dipoles.
      </g-message>
      <g-callback-answer>Prompt saved.</g-callback-answer>
      <g-callback-answer lang="id">Prompt tersimpan.</g-callback-answer>
    </g-base>

    <g-base id="${Base.typePrompt}">
      ${this.kbk.home()}
      <g-message>
        <b>✏️ Custom prompt</b>

        Send me the prompt text now — I will save it and use it for your
        next polishes until you pick another preset.
      </g-message>
      <g-message lang="id">
        <b>✏️ Prompt custom</b>

        Kirim teks prompt sekarang — aku akan menyimpannya dan memakainya
        untuk polish berikutnya sampai kamu memilih preset lain.
      </g-message>
    </g-base>
  `
}
