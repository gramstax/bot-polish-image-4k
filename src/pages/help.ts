import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class HelpPage extends PageBase {
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
      await this.renderText({mode: `auto`, keyboard: this.inlineKeyboardT([StartPage])})
    },
    process: () => {},
  }

  static template = `
    <g-base>
      <g-description>Full help and command list</g-description>
      <g-description lang="id">Bantuan lengkap dan daftar perintah</g-description>
      ${this.kbk.back()}
      <g-message>
        <b>🆘 Help — Polish 4K</b>

        <b>How it works</b>
        Send a photo — in English or Indonesian — and I will polish it
        through the Gemini website in a browser: upscale to 4K, enhance
        the details, and send the result back here. One polish runs at
        a time, in order. The same Gemini chat is reused for up to 50
        polishes, then a new chat starts.

        <b>Examples</b>
        Send a photo here
        /polish — then send the photo
        A photo with a caption — the caption is a one-off custom prompt

        <b>Commands</b>
        All commands are in English. Replies are bilingual — English by
        default, Indonesian when you pick it with /language.
        /start — introduction &amp; main menu
        /polish — polish a photo to 4K
        /prompts — choose the polish prompt (4K Upscale + Colorize,
        4K Upscale only, or your own custom prompt)
        /status — queue and job status
        /language — switch language (English / Indonesia)
        /forget — erase my recent polish jobs
        /help — this page

        <b>What to set up so every feature works</b>
        • A Google login, once, in the bot's browser profile (see
          README "One-time Google login") — without it, Gemini shows a
          login wall and polishes fail honestly instead of faking a result.
        • The bot needs the Moli browser installed (see README).
        • Only photos can be polished. Send a photo, not a file.
      </g-message>
      <g-message lang="id">
        <b>🆘 Bantuan — Polish 4K</b>

        <b>Cara kerja</b>
        Kirim foto — pakai bahasa Inggris atau Indonesia — dan aku akan
        memolesnya lewat situs Gemini di browser: upscale ke 4K, pertajam
        detailnya, lalu mengirim hasilnya ke sini. Satu polish berjalan
        dalam satu waktu, sesuai antrean. Chat Gemini yang sama dipakai
        sampai 50 polish, lalu chat baru dimulai.

        <b>Contoh</b>
        Kirim foto ke sini
        /polish — lalu kirim fotonya
        Foto dengan caption — caption jadi prompt custom sekali pakai

        <b>Perintah</b>
        Semua perintah memakai bahasa Inggris. Balasannya bilingual —
        bahasa Inggris sebagai default, bahasa Indonesia kalau kamu pilih
        lewat /language.
        /start — perkenalan &amp; menu utama
        /polish — polish foto ke 4K
        /prompts — pilih prompt polish (4K Upscale + Colorize,
        4K Upscale saja, atau prompt custom kamu sendiri)
        /status — antrean dan status job
        /language — ganti bahasa (English / Indonesia)
        /forget — hapus job polish terakhirmu
        /help — halaman ini

        <b>Yang perlu disiapkan supaya semua fitur jalan</b>
        • Login Google sekali di profil browser bot (lihat README
          "One-time Google login") — tanpa itu, Gemini menampilkan
          halaman login dan polish gagal secara jujur, bukan memalsukan hasil.
        • Bot butuh browser Moli terpasang (lihat README).
        • Hanya foto yang bisa dipoles. Kirim foto, bukan file.
      </g-message>
    </g-base>
  `
}
