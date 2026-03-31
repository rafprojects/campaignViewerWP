import { StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { createPortal } from 'react-dom'
import App from './App'
import { shadowStyles } from './shadowStyles'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { ModalsProvider } from '@mantine/modals'
import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import 'dockview/dist/styles/dockview.css'
import { startWebVitalsMonitoring } from './services/monitoring/webVitals'
import { initSentry } from './services/monitoring/sentry'
import { ThemeProvider } from './contexts/ThemeContext'
import { useTheme } from './hooks/useTheme'
import { buildThemeScopeSelector, ensureHostThemeScopeToken } from './utils/themeScope'

type MountProps = Record<string, unknown>

const query = new URLSearchParams(window.location.search)
const windowFlag = (window as Window & { __USE_SHADOW_DOM__?: boolean }).__USE_SHADOW_DOM__
const useShadowDom = windowFlag ?? query.get('shadow') !== '0'

startWebVitalsMonitoring()

// Read WP-injected configuration.
const wpsgConfig = window.__WPSG_CONFIG__

const sentryDsn = wpsgConfig?.sentryDsn ?? window.__WPSG_SENTRY_DSN__
void initSentry({ dsn: sentryDsn })

// If the WP admin disables user theme override, we disable localStorage
// persistence so the admin-chosen theme is always used.
const allowThemePersistence = wpsgConfig?.allowUserThemeOverride !== false

// P20-I-6: Shared React root for multi-shortcode pages (default: off).
const useSharedRoot = wpsgConfig?.sharedRoot === true

if ('serviceWorker' in navigator && !import.meta.env.DEV) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .catch((error) => {
        console.error('Service worker registration failed:', error);
      });
  });
}

/**
 * Allowed shortcode prop keys. Prevents external shortcode consumers from
 * injecting unexpected keys into the React component tree (P20-H-1).
 */
const ALLOWED_PROPS = new Set(['campaign', 'company'])

const parseProps = (node: Element): MountProps => {
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

const ensureThemeScopeSelector = (host: HTMLElement): string => {
  return buildThemeScopeSelector(ensureHostThemeScopeToken(host))
}

/**
 * Inner shell that consumes the ThemeContext and feeds the resolved
 * MantineThemeOverride into MantineProvider. This component re-renders
 * only when the theme changes (O(1) map lookup, pre-computed objects).
 */
// eslint-disable-next-line react-refresh/only-export-components
function ThemedApp({
  props,
  isShadowDom,
  shadowRootEl,
}: {
  props: MountProps
  isShadowDom: boolean
  shadowRootEl?: ShadowRoot
}) {
  const { mantineTheme, colorScheme } = useTheme()

  return (
    <MantineProvider
      theme={mantineTheme}
      forceColorScheme={colorScheme}
      // Scope Mantine CSS variables into shadow root or document :root
      cssVariablesSelector={isShadowDom ? ':host' : ':root'}
      // getRootElement controls where data-mantine-color-scheme is set.
      // Must match cssVariablesSelector: :host → shadow host, :root → <html>.
      getRootElement={() =>
        isShadowDom && shadowRootEl
          ? (shadowRootEl.host as HTMLElement) ?? document.documentElement
          : document.documentElement
      }
    >
      <Notifications />
      <ModalsProvider>
        <App {...props} />
      </ModalsProvider>
    </MantineProvider>
  )
}

/**
 * Top-level render — wraps everything in ThemeProvider, then ThemedApp
 * bridges ThemeContext → MantineProvider.
 */
const renderApp = (
  mountNode: Element,
  hostElement: HTMLElement,
  props: MountProps,
  shadowRootEl?: ShadowRoot,
) => {
  const isShadow = !!shadowRootEl
  const themeScopeSelector = shadowRootEl ? undefined : ensureThemeScopeSelector(hostElement)

  createRoot(mountNode).render(
    <StrictMode>
      <ThemeProvider
        shadowRoot={shadowRootEl ?? null}
        hostElement={hostElement}
        themeScopeSelector={themeScopeSelector}
        allowPersistence={allowThemePersistence}
      >
        <ThemedApp
          props={props}
          isShadowDom={isShadow}
          shadowRootEl={shadowRootEl}
        />
      </ThemeProvider>
    </StrictMode>,
  )
}

const mountWithShadow = (host: HTMLElement, props: MountProps) => {
  // Prevent double mounting - check host element first
  if (host.hasAttribute('data-wpsg-mounted')) {
    return
  }
  host.setAttribute('data-wpsg-mounted', 'true')
  
  const shadowRoot = host.shadowRoot ?? host.attachShadow({ mode: 'open' })
  
  if (!shadowRoot.querySelector('style[data-wpsg]')) {
    const styleTag = document.createElement('style')
    styleTag.setAttribute('data-wpsg', 'true')
    styleTag.textContent = shadowStyles
    shadowRoot.appendChild(styleTag)
  }

  const mountPoint = document.createElement('div')
  mountPoint.setAttribute('data-wpsg-mount', 'true')
  shadowRoot.appendChild(mountPoint)
  renderApp(mountPoint, host, props, shadowRoot)
}

const mountDefault = (host: HTMLElement, props: MountProps) => {
  // Prevent double mounting
  if (host.hasAttribute('data-wpsg-mounted')) {
    return
  }
  host.setAttribute('data-wpsg-mounted', 'true')
  renderApp(host, host, props)
}

/**
 * I-6: Mount multiple shortcodes via a single React root using portals.
 * Galleries rendered through portals share the same React tree, which means:
 *   • SWR request deduplication — identical keys are fetched only once.
 *   • Reduced provider overhead — one StrictMode boundary for all galleries.
 * Each gallery still gets its own ThemeProvider + MantineProvider so shadow
 * DOM CSS variable scoping and per-instance config continue to work.
 */
const sharedRootMap = new WeakMap<HTMLElement, Root>();

const mountSharedRoot = (nodes: NodeListOf<HTMLElement>) => {
  interface MountInstance {
    mountPoint: HTMLElement
    hostElement: HTMLElement
    shadowRoot?: ShadowRoot
    props: MountProps
    portalKey: string
    themeScopeSelector?: string
  }

  const instances: MountInstance[] = []

  nodes.forEach((host) => {
    if (host.hasAttribute('data-wpsg-mounted')) return
    host.setAttribute('data-wpsg-mounted', 'true')

    if (useShadowDom) {
      const shadowRoot = host.shadowRoot ?? host.attachShadow({ mode: 'open' })

      if (!shadowRoot.querySelector('style[data-wpsg]')) {
        const styleTag = document.createElement('style')
        styleTag.setAttribute('data-wpsg', 'true')
        styleTag.textContent = shadowStyles
        shadowRoot.appendChild(styleTag)
      }

      const mountPoint = document.createElement('div')
      mountPoint.setAttribute('data-wpsg-mount', 'true')
      shadowRoot.appendChild(mountPoint)
      const portalKey = host.id || (host.dataset.wpsgKey ??= `wpsg-${Math.random().toString(36).slice(2, 10)}`)
      instances.push({ mountPoint, hostElement: host, shadowRoot, props: parseProps(host), portalKey })
    } else {
      const portalKey = host.id || (host.dataset.wpsgKey ??= `wpsg-${Math.random().toString(36).slice(2, 10)}`)
      instances.push({
        mountPoint: host,
        hostElement: host,
        props: parseProps(host),
        portalKey,
        themeScopeSelector: ensureThemeScopeSelector(host),
      })
    }
  })

  if (instances.length === 0) return

  // Load global styles once for non-shadow-DOM mode.
  if (!useShadowDom) {
    import('./styles/global.scss')
  }

  // Hidden container that anchors the single React root — reuse if it already exists.
  let container = document.getElementById('wpsg-shared-root')
  if (!container) {
    container = document.createElement('div')
    container.id = 'wpsg-shared-root'
    container.style.display = 'none'
    document.body.appendChild(container)
  }

  // Persist the React root so repeated mounts call render() instead of createRoot().
  let root = sharedRootMap.get(container);
  if (!root) {
    root = createRoot(container);
    sharedRootMap.set(container, root);
  }

  root.render(
    <StrictMode>
      {instances.map((inst, i) =>
        createPortal(
          <ThemeProvider
            shadowRoot={inst.shadowRoot ?? null}
            hostElement={inst.hostElement}
            themeScopeSelector={inst.themeScopeSelector}
            allowPersistence={i === 0 && allowThemePersistence}
          >
            <ThemedApp
              props={inst.props}
              isShadowDom={!!inst.shadowRoot}
              shadowRootEl={inst.shadowRoot}
            />
          </ThemeProvider>,
          inst.mountPoint,
          inst.portalKey,
        ),
      )}
    </StrictMode>,
  )
}

const rootHost = document.getElementById('root')
if (import.meta.env.DEV) {
  console.log('[WPSG] Mount init - rootHost:', rootHost, 'useShadowDom:', useShadowDom)
  console.log('[WPSG] All .wp-super-gallery elements:', document.querySelectorAll('.wp-super-gallery').length)
}

if (rootHost) {
  if (import.meta.env.DEV) console.log('[WPSG] Mounting to #root')
  const props = parseProps(rootHost)
  if (useShadowDom) {
    mountWithShadow(rootHost, props)
  } else {
    import('./styles/global.scss')
    mountDefault(rootHost, props)
  }
} else {
  // Only search for .wp-super-gallery if #root doesn't exist
  const nodes = document.querySelectorAll<HTMLElement>('.wp-super-gallery')
  if (import.meta.env.DEV) console.log('[WPSG] No #root, mounting to', nodes.length, '.wp-super-gallery elements')

  // I-6: When shared root is enabled and there are multiple shortcodes,
  // use a single React root with portals for deduplication benefits.
  if (useSharedRoot && nodes.length > 1) {
    if (import.meta.env.DEV) console.log('[WPSG] Shared root: mounting', nodes.length, 'galleries via portals')
    mountSharedRoot(nodes)
  } else {
    nodes.forEach((node, index) => {
      if (import.meta.env.DEV) console.log('[WPSG] Processing node', index, '- already mounted:', node.hasAttribute('data-wpsg-mounted'))
      const props = parseProps(node)
      if (useShadowDom) {
        mountWithShadow(node, props)
      } else {
        import('./styles/global.scss')
        mountDefault(node, props)
      }
    })
  }
}
