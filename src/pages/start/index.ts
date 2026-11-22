import {PageBase} from "~/base/page"
import {HelpPage} from "../help"
import {LanguagePage} from "../language"
import {PolishPage} from "../polish"
import {PromptsPage} from "../prompts"
import {StatusPage} from "../status"

export class StartPage extends PageBase {
  static data = this.buildData()

  async handleCallbackQueryData() {
    await this.gdefault.show()
  }

  async handleCommandText() {
    await this.gdefault.show()
  }

  helper = {}
  gdefault = {
    show: async () => {
      await this.clearSession()
      await this.renderText({
        mode: `auto`,
        keyboard: this.inlineKeyboardT([PolishPage, PromptsPage, StatusPage, LanguagePage, HelpPage], `2`),
        data: {userName: this.from?.username ?? this.from?.first_name ?? `you`},
      })
    },
    process: () => {},
  }

  static template = `
    <g-base>
      <g-description>Introduction and main menu</g-description>
      <g-description lang="id">Perkenalan dan menu utama</g-description>
      ${this.kbk.mainMenu()}
      <g-message>
        <b>👋 Hello {{userName}}, I'm Polish 4K!</b>

        Send me a photo and I will polish it with AI — upscale to 4K
        and enhance the details, in English or Indonesian. The polish
        runs in the browser and takes a while, so I confirm your photo
        right away and edit that message with the progress.

        <b>Try it:</b>
        Send a photo here — or /polish first, then the photo.
        A photo caption works as a one-off custom prompt.

        <b>Commands:</b>
        /polish — polish a photo to 4K
        /prompts — choose the polish prompt
        /status — queue and job status
        /language — switch language (English / Indonesia)
        /forget — erase my recent polish jobs
        /help — full help
      </g-message>
      <g-message lang="id">
        <b>👋 Halo {{userName}}, aku Polish 4K!</b>

        Kirim foto dan aku akan memolesnya dengan AI — upscale ke 4K
        dan pertajam detailnya, pakai bahasa Inggris atau Indonesia.
        Polish berjalan di browser dan butuh waktu, jadi aku konfirmasi
        fotomu langsung dan mengedit pesan itu dengan progresnya.

        <b>Coba:</b>
        Kirim foto ke sini — atau /polish dulu, baru fotonya.
        Caption foto bisa dipakai sebagai prompt custom sekali pakai.

        <b>Perintah:</b>
        /polish — polish foto ke 4K
        /prompts — pilih prompt polish
        /status — antrean dan status job
        /language — ganti bahasa (English / Indonesia)
        /forget — hapus job polish terakhirmu
        /help — bantuan lengkap
      </g-message>
    </g-base>
  `
}
