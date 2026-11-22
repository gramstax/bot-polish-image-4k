/**
 * Prompt presets for the polish worker.
 *
 * The preset TEXT is pasted verbatim into Gemini on every request —
 * the same chat session never replaces the prompt (Damar's rule,
 * restored-content-factory 2026-11-21). The default preset is the
 * verbatim prompt from `4K Upscale and Detail Enhancement.md`
 * (restored-content-factory/polish-gemini-web), copied exactly,
 * including its final colorize sentence.
 *
 * These are NOT user-facing strings: they are the model-facing prompt
 * text, the documented exception to the "no string dictionary" rule
 * (same as the LLM system prompts in the sibling bots).
 */

/** One Gemini chat session is reused for at most this many polishes; the 51st starts a new chat (Damar 2026-11-22). */
export const SESSION_MAX_REQUESTS = 50

/** The colorize sentence — the only difference between the two built-in presets. */
export const COLORIZE_SENTENCE = `If the source image is black-and-white, colorize it with realistic, historically accurate colors true to the original objects — natural skin tones, authentic period clothing, steel, wood, and fabric colors — without changing the composition, lighting, or details.`

/** Default preset — the verbatim prompt, colorize sentence included. */
export const PROMPT_UPSCALE_COLORIZE = `Upscale the uploaded image to 4K resolution, preserving 100 % character consistency, original facial features, clothing details, and scene composition. Maintain original lighting, texture, and fine details such as hair strands, fabric texture, reflections, and shadows. Apply high-quality upscaling with sharp but natural edges, no distortions, and minimal AI artifacts. Keep the character’s identity, proportions, and expressions unchanged. Enhance clarity in skin texture, eyes, and background elements while preserving the original color palette and artistic style. Output a crisp, highly detailed, ultra-high-resolution image suitable for print and professional display. ${COLORIZE_SENTENCE}`

/** Same prompt WITHOUT the final colorize sentence — for photos that are already in color. */
export const PROMPT_UPSCALE_ONLY = `Upscale the uploaded image to 4K resolution, preserving 100 % character consistency, original facial features, clothing details, and scene composition. Maintain original lighting, texture, and fine details such as hair strands, fabric texture, reflections, and shadows. Apply high-quality upscaling with sharp but natural edges, no distortions, and minimal AI artifacts. Keep the character’s identity, proportions, and expressions unchanged. Enhance clarity in skin texture, eyes, and background elements while preserving the original color palette and artistic style. Output a crisp, highly detailed, ultra-high-resolution image suitable for print and professional display.`

export type PromptId = `upscale-colorize` | `upscale-only` | `custom`

export interface IPromptPreset {
  id: PromptId
  /** Short name shown on the Telegram keyboard (label text lives in the template, not here). */
  name: string
  /** The exact text pasted into Gemini (empty for `custom` — the user's own text is used). */
  text: string
}

export const PROMPT_PRESETS: IPromptPreset[] = [
  {id: `upscale-colorize`, name: `4K Upscale + Colorize`, text: PROMPT_UPSCALE_COLORIZE},
  {id: `upscale-only`, name: `4K Upscale only`, text: PROMPT_UPSCALE_ONLY},
  {id: `custom`, name: `Custom prompt`, text: ``},
]

export function findPreset(id: string | undefined): IPromptPreset | undefined {
  return PROMPT_PRESETS.find((p) => p.id === id)
}

/**
 * Resolve the exact prompt text for a job: the preset text, or the user's
 * stored custom prompt when `custom` is selected. Returns undefined when
 * `custom` is selected but no custom prompt has been saved yet — the caller
 * must ask the user to type one instead of sending an empty prompt.
 */
export function resolvePromptText(promptId: PromptId | undefined, customPrompt: string | undefined): string | undefined {
  const preset = findPreset(promptId ?? `upscale-colorize`)
  if (preset === undefined) return PROMPT_UPSCALE_COLORIZE
  if (preset.id !== `custom`) return preset.text
  const custom = (customPrompt ?? ``).trim()
  return custom === `` ? undefined : custom
}
