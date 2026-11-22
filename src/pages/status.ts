import {PageBase} from "~/base/page"
import {jobStatusLabel} from "~/types/polish"

/**
 * StatusPage — /status: the user's recent polish jobs + queue depth +
 * the Gemini session counter (N/50 requests in the current chat).
 *
 * Job rows come from the user's recent-job list in LMDB; the template
 * renders them with `<g-map>`. Status labels are computed in the helper
 * (dynamic data) and passed as template variables — the sentences
 * themselves live in the template.
 */
export class StatusPage extends PageBase {
  static data = this.buildData()

  async handleCommandText() {
    await this.gstatus.show()
  }

  async handleCallbackQueryData() {
    await this.gstatus.show()
  }

  helper = {}
  gstatus = {
    show: async () => {
      const userId = this.from?.id
      if (userId === undefined) return
      const lang = this.lang()
      const ids = this.db.user.recentJobIds(userId)
      const jobs = this.db.jobs.listByIds(ids).map((job) => ({
        promptName: job.promptName,
        status: jobStatusLabel(job.status, lang),
        percent: job.percent,
        errorCode: job.errorCode ?? ``,
      }))
      const session = this.db.session.find()
      await this.renderText({
        data: {
          jobs,
          queueSize: this.db.jobs.queueSize(),
          sessionCount: session?.requestCount ?? 0,
          sessionMax: 50,
        },
      })
    },
    process: () => {},
  }

  static template = `
    <g-base>
      <g-description>Show polish queue and job status</g-description>
      <g-description lang="id">Lihat antrean dan status polish</g-description>
      <g-message>
        <b>📊 Polish status</b>

        Queue: {{queueSize}} job(s) waiting
        Gemini session: {{sessionCount}}/{{sessionMax}} requests in this chat

        <g-map src="jobs" join="\n">• {{e.promptName}} — {{e.status}} ({{e.percent}}%)<g-ifelse>e.errorCode ? ' — ' + e.errorCode : ''</g-ifelse>
</g-map><g-ifelse>jobs.length === 0 ? 'No polishes yet — send a photo to start one.' : ''</g-ifelse>
      </g-message>
      <g-message lang="id">
        <b>📊 Status polish</b>

        Antrean: {{queueSize}} job menunggu
        Sesi Gemini: {{sessionCount}}/{{sessionMax}} permintaan di chat ini

        <g-map src="jobs" join="\n">• {{e.promptName}} — {{e.status}} ({{e.percent}}%)<g-ifelse>e.errorCode ? ' — ' + e.errorCode : ''</g-ifelse>
</g-map><g-ifelse>jobs.length === 0 ? 'Belum ada polish — kirim foto untuk memulai.' : ''</g-ifelse>
      </g-message>
    </g-base>
  `
}
