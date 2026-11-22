import type {JobStatus} from "~/db/schema/job"
import type {PromptId} from "~/lib/prompts"

/** A polish job as the pages and /status read it. */
export interface IPolishJob {
  id: string
  userId: number
  chatId: number
  ackMessageId?: number
  photoPath: string
  promptId: PromptId
  promptText: string
  promptName: string
  status: JobStatus
  percent: number
  errorCode?: string
  resultPath?: string
  position: number
  createdAt: Date
  updatedAt?: Date
}

/** Short status label for /status rows (rendered by the template). */
export function jobStatusLabel(status: JobStatus, lang: `en` | `id`): string {
  const labels: Record<JobStatus, {en: string; id: string}> = {
    queued: {en: `queued`, id: `dalam antrean`},
    running: {en: `running`, id: `berjalan`},
    done: {en: `done`, id: `selesai`},
    failed: {en: `failed`, id: `gagal`},
  }
  return labels[status][lang]
}
