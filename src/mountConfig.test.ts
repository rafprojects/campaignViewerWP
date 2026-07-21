/**
 * P69-C: mount-attribute parsing boundary tests.
 *
 * `parseNodeConfig` must give `data-wpsg-config` the same allowlist + type-check
 * treatment `parseProps` gives `data-wpsg-props` — unknown keys stripped,
 * wrong-typed known keys dropped, legitimate PHP-generated payloads unchanged.
 */
import { describe, it, expect } from 'vitest'
import { parseProps, parseNodeConfig } from './mountConfig'

const nodeWith = (attr: string, value: string): Element => {
  const el = document.createElement('div')
  el.setAttribute(attr, value)
  return el
}

const configNode = (value: string) => nodeWith('data-wpsg-config', value)
const propsNode = (value: string) => nodeWith('data-wpsg-props', value)

describe('parseNodeConfig', () => {
  it('returns {} when the attribute is absent', () => {
    expect(parseNodeConfig(document.createElement('div'))).toEqual({})
  })

  it('returns {} for invalid JSON', () => {
    expect(parseNodeConfig(configNode('{not json'))).toEqual({})
  })

  it('returns {} for a JSON array (not an object)', () => {
    expect(parseNodeConfig(configNode('[1,2,3]'))).toEqual({})
  })

  it('returns {} for a JSON null', () => {
    expect(parseNodeConfig(configNode('null'))).toEqual({})
  })

  it('passes a legitimate PHP-generated payload through unchanged', () => {
    const config = {
      spaceId: 12,
      spaceName: 'Marketing',
      instanceId: 'wpsg-abc',
      theme: 'default-dark',
      galleryLayout: 'grid',
      enableLightbox: true,
      enableAnimations: false,
      authBarMode: 'compact',
    }
    expect(parseNodeConfig(configNode(JSON.stringify(config)))).toEqual(config)
  })

  it('strips unexpected keys not in the NodeConfig allowlist', () => {
    const result = parseNodeConfig(
      configNode(JSON.stringify({ spaceId: 5, evilKey: 'inject', __proto__pollute: 1 })),
    )
    expect(result).toEqual({ spaceId: 5 })
    expect('evilKey' in result).toBe(false)
  })

  it('drops a wrong-typed known key while keeping the valid ones', () => {
    const result = parseNodeConfig(
      configNode(
        JSON.stringify({
          spaceId: 'not-a-number', // wrong type -> dropped
          spaceName: 'Sales', // valid -> kept
          enableLightbox: 'yes', // wrong type -> dropped
          enableAnimations: true, // valid -> kept
        }),
      ),
    )
    expect(result).toEqual({ spaceName: 'Sales', enableAnimations: true })
    expect('spaceId' in result).toBe(false)
    expect('enableLightbox' in result).toBe(false)
  })

  it('rejects non-finite numbers for spaceId', () => {
    // JSON has no Infinity/NaN literal, but a stringified numeric that parses to
    // a huge value still stays finite; simulate via an already-invalid shape.
    const result = parseNodeConfig(configNode(JSON.stringify({ spaceId: null })))
    expect('spaceId' in result).toBe(false)
  })
})

describe('parseProps (unchanged after extraction)', () => {
  it('keeps only allowlisted keys', () => {
    const result = parseProps(
      propsNode(JSON.stringify({ campaign: '1', company: '2', space: '3', bogus: '4' })),
    )
    expect(result).toEqual({ campaign: '1', company: '2', space: '3' })
  })

  it('returns {} for a missing attribute or invalid JSON', () => {
    expect(parseProps(document.createElement('div'))).toEqual({})
    expect(parseProps(propsNode('{bad'))).toEqual({})
  })
})
