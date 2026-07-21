import { z } from 'zod'

/**
 * Parsing + validation for the two attributes PHP stamps onto each mount host:
 * `data-wpsg-props` (shortcode props) and `data-wpsg-config` (per-node config).
 *
 * Extracted from main.tsx so the mount-attribute boundary can be unit-tested
 * without importing main.tsx's side effects (Sentry init, SW registration,
 * DOM mounting). See mountConfig.test.ts.
 */

export type MountProps = Record<string, unknown>

/**
 * Allowed shortcode prop keys. Prevents external shortcode consumers from
 * injecting unexpected keys into the React component tree (P20-H-1).
 */
export const ALLOWED_PROPS = new Set(['campaign', 'company', 'space'])

export const parseProps = (node: Element): MountProps => {
  const raw = node.getAttribute('data-wpsg-props')
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(([k]) => ALLOWED_PROPS.has(k)),
    )
  } catch {
    return {}
  }
}

export interface NodeConfig {
  spaceId?: number
  spaceName?: string
  instanceId?: string
  theme?: string
  galleryLayout?: string
  enableLightbox?: boolean
  enableAnimations?: boolean
  authBarMode?: string
}

// Mirror the existing zod idioms in types/settingsSchemas.ts: each field is
// optional and `.catch(undefined)` so a wrong-typed value drops that single
// field (falling back to the downstream default) instead of failing the whole
// parse. Unknown keys are stripped by z.object's default behavior.
const optionalFiniteNumber = z.number().finite().optional().catch(undefined)
const optionalString = z.string().optional().catch(undefined)
const optionalBoolean = z.boolean().optional().catch(undefined)

const NodeConfigSchema = z.object({
  spaceId: optionalFiniteNumber,
  spaceName: optionalString,
  instanceId: optionalString,
  theme: optionalString,
  galleryLayout: optionalString,
  enableLightbox: optionalBoolean,
  enableAnimations: optionalBoolean,
  authBarMode: optionalString,
})

const pruneUndefinedKeys = <T extends Record<string, unknown>>(value: T): T =>
  Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  ) as T

/**
 * P69-C: runtime allowlist + type-check for `data-wpsg-config`, giving it the
 * same treatment `parseProps` gives `data-wpsg-props`. The attribute is
 * PHP-generated today, but validating here keeps the mount-config boundary
 * consistent: unknown keys are stripped and wrong-typed known keys are dropped
 * (so downstream defaults apply) rather than passed through via an unchecked
 * `as NodeConfig` assertion.
 */
export const parseNodeConfig = (node: Element): NodeConfig => {
  const raw = node.getAttribute('data-wpsg-config')
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const result = NodeConfigSchema.safeParse(parsed)
    if (!result.success) return {}
    // pruneUndefinedKeys removes the keys that `.catch(undefined)` produced for
    // wrong-typed inputs, so the runtime object matches NodeConfig exactly. The
    // cast only bridges zod's `T | undefined` field types to NodeConfig's
    // exactOptionalPropertyTypes shape — it is not bypassing validation.
    return pruneUndefinedKeys(result.data) as NodeConfig
  } catch {
    return {}
  }
}
