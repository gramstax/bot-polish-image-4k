import {PageBase} from "~/base/page"

/**
 * /forget — clear this user's recent polish jobs (max 5) + saved custom
 * prompt from LMDB.
 *
 * The confirmation sentence lives in `static template` (EN default +
 * `lang="id"` variant). Strict rule (Damar 2026-11-19 ~14:43 WIB):
 * no string dictionary.
 */
export class ForgetPage extends PageBase {
  static data = this.buildData()

  async handleCommandText() {
    await this.gdefault.show()
  }

  helper = {}

  gdefault = {
    show: async () => {
      const userId = this.from?.id
      if (userId === undefined) return
      await this.db.user.clearPolishData(userId)
      await this.renderText({data: {}})
    },
    process: () => {},
  }

  static template = `
    <g-base>
      <g-description>Erase my recent polish jobs</g-description>
      <g-description lang="id">Hapus job polish terakhirmu</g-description>
      <g-message>Forgotten. Your recent polish jobs and custom prompt are erased — send a new photo whenever you are ready.</g-message>
      <g-message lang="id">Sudah dihapus. Job polish terakhirmu dan prompt custom sudah terhapus — kirim foto baru kapan pun kamu siap.</g-message>
    </g-base>
  `
}
