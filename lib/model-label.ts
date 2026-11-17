/** Human label for a model id. `@long` is the long-prompt pricing bucket (see lib/pricing.ts). */
export function modelLabel(model: string): string {
  const long = model.endsWith('@long')
  const id = long ? model.slice(0, -'@long'.length) : model
  const m = id.match(/(fable|mythos|opus|sonnet|haiku)-(\d+)(?:-(\d+))?(?!\d)/)
  let label: string
  if (m) {
    const family = m[1][0].toUpperCase() + m[1].slice(1)
    // A trailing 8-digit date (…-20251101) is not a minor version
    const minor = m[3] && m[3].length <= 2 ? `.${m[3]}` : ''
    label = `${family} ${m[2]}${minor}`
  } else {
    label = id.split('-').slice(0, 3).join('-')
  }
  return long ? `${label} (long prompt)` : label
}
