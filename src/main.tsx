import './i18n'
import { StrictMode, useMemo } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { createPortal } from 'react-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { shadowStyles } from './shadowStyles'
import { MantineProvider, mergeThemeOverrides } from '@mantine/core'
import i18n from './i18n'
import { Notifications } from '@mantine/notifications'
import { ModalsProvider } from '@mantine/modals'
import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import 'dockview/dist/styles/dockview.css'
import './styles/builder.css'
import './styles/wpAdminFormReset.css'
import { startWebVitalsMonitoring } from './services/monitoring/webVitals'
import { initSentry } from './services/monitoring/sentry'
import { createAppQueryClient } from './services/queryClient'
import { ThemeProvider } from './contexts/ThemeContext'
import { resolveWpThemeIds } from './services/wpThemeId'
import { useTheme } from './hooks/useTheme'
import { buildThemeScopeSelector, ensureHostThemeScopeToken } from './utils/themeScope'
import { RootIdProvider } from '@wp-super-gallery/shared-ui'
import { parseProps, parseNodeConfig, type MountProps, type NodeConfig } from './mountConfig'
import { ErrorBoundary } from './components/ErrorBoundary'

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
    // P50-F: prefer the PHP-injected absolute URL (served with Service-Worker-Allowed: /
    // so the SW can claim root scope). Falls back to the Vite BASE_URL relative path
    // for non-WordPress or local dev builds where the PHP endpoint isn't available.
    const swUrl = window.__WPSG_CONFIG__?.swUrl ?? `${import.meta.env.BASE_URL}sw.js`;
    void navigator.serviceWorker
      .register(swUrl)
      .catch((error) => {
        console.error('Service worker registration failed:', error);
      });
  });
}

const ensureThemeScopeSelector = (host: HTMLElement): string => {
  return buildThemeScopeSelector(ensureHostThemeScopeToken(host))
}

/**
 * P36-A: Stable root identity for a host element. Used to scope localStorage
 * keys (`wpsg_view_<rootId>_<feature>`) across multiple shortcode mounts.
 * Priority: element id → page-path + positional index fallback.
 * The path component prevents positional keys ('wpsg-0') from colliding
 * across unrelated pages that each render a single un-id'd shortcode.
 */
const getRootId = (host: HTMLElement, index = 0): string => {
  if (host.id) return host.id;
  const slug = window.location.pathname.replace(/\//g, '-').replace(/^-|-$/g, '') || 'root';
  return `wpsg-${slug}-${index}`;
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
  shadowRootEl?: ShadowRoot | undefined
}) {
  const { mantineTheme, colorScheme } = useTheme()

  // P60-D: give every Mantine close button (modals, drawers) an accessible name.
  // Mantine leaves CloseButton unlabeled by default, which trips axe `button-name`
  // across the app's ~36 modals; components that pass their own aria-label still win.
  const themeWithA11y = useMemo(
    () =>
      mergeThemeOverrides(mantineTheme, {
        components: {
          CloseButton: { defaultProps: { 'aria-label': i18n.t('common_close', 'Close') } },
        },
      }),
    [mantineTheme],
  )

  return (
    <MantineProvider
      theme={themeWithA11y}
      forceColorScheme={colorScheme}
      deduplicateInlineStyles
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
      <Notifications withinPortal={false} />
      <ModalsProvider>
        {/* P69-D: public-facing boundary. No isAdmin prop → a public visitor
            sees generic copy, never a raw exception message (Sentry still gets
            the full error). Admin sub-trees have their own inner ErrorBoundary
            passing isAdmin so operators keep raw messages for troubleshooting. */}
        <ErrorBoundary>
          <App {...props} />
        </ErrorBoundary>
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
  rootId: string,
  shadowRootEl?: ShadowRoot,
  nodeConfig: NodeConfig = {},
) => {
  const isShadow = !!shadowRootEl
  const themeScopeSelector = shadowRootEl ? undefined : ensureThemeScopeSelector(hostElement)
  const queryClient = createAppQueryClient()
  const instanceId = nodeConfig.spaceId != null ? String(nodeConfig.spaceId) : undefined

  createRoot(mountNode).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RootIdProvider value={rootId}>
          <ThemeProvider
            shadowRoot={shadowRootEl ?? null}
            hostElement={hostElement}
            themeScopeSelector={themeScopeSelector}
            allowPersistence={allowThemePersistence}
            defaultThemeId={nodeConfig.theme}
            instanceId={instanceId}
            resolveWpThemeIds={resolveWpThemeIds}
          >
            <ThemedApp
              props={props}
              isShadowDom={isShadow}
              shadowRootEl={shadowRootEl}
            />
          </ThemeProvider>
        </RootIdProvider>
      </QueryClientProvider>
    </StrictMode>,
  )
}

const mountWithShadow = (host: HTMLElement, props: MountProps, rootId: string, nodeConfig: NodeConfig = {}) => {
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
  renderApp(mountPoint, host, props, rootId, shadowRoot, nodeConfig)
}

const mountDefault = (host: HTMLElement, props: MountProps, rootId: string, nodeConfig: NodeConfig = {}) => {
  // Prevent double mounting
  if (host.hasAttribute('data-wpsg-mounted')) {
    return
  }
  host.setAttribute('data-wpsg-mounted', 'true')
  renderApp(host, host, props, rootId, undefined, nodeConfig)
}

/**
 * I-6: Mount multiple shortcodes via a single React root using portals.
 * Galleries rendered through portals share the same React tree, which means:
 *   • shared query/cache deduplication for settings and campaign data.
 *   • Reduced provider overhead — one StrictMode boundary for all galleries.
 * Each gallery still gets its own ThemeProvider + MantineProvider so shadow
 * DOM CSS variable scoping and per-instance config continue to work.
 */
const sharedRootMap = new WeakMap<HTMLElement, Root>();
const sharedQueryClientMap = new WeakMap<HTMLElement, ReturnType<typeof createAppQueryClient>>();

const mountSharedRoot = (nodes: NodeListOf<HTMLElement>) => {
  interface MountInstance {
    mountPoint: HTMLElement
    hostElement: HTMLElement
    shadowRoot?: ShadowRoot
    props: MountProps
    portalKey: string
    themeScopeSelector?: string
    nodeConfig: NodeConfig
  }

  const instances: MountInstance[] = []

  nodes.forEach((host, index) => {
    if (host.hasAttribute('data-wpsg-mounted')) return
    host.setAttribute('data-wpsg-mounted', 'true')

    const nodeConfig = parseNodeConfig(host)
    const props = { ...parseProps(host), spaceId: nodeConfig.spaceId, spaceName: nodeConfig.spaceName, instanceId: nodeConfig.instanceId, ...(nodeConfig.authBarMode !== undefined && { authBarMode: nodeConfig.authBarMode }) }

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
      const portalKey = getRootId(host, index)
      instances.push({ mountPoint, hostElement: host, shadowRoot, props, portalKey, nodeConfig })
    } else {
      const portalKey = getRootId(host, index)
      instances.push({
        mountPoint: host,
        hostElement: host,
        props,
        portalKey,
        themeScopeSelector: ensureThemeScopeSelector(host),
        nodeConfig,
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

  let queryClient = sharedQueryClientMap.get(container)
  if (!queryClient) {
    queryClient = createAppQueryClient()
    sharedQueryClientMap.set(container, queryClient)
  }

  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        {instances.map((inst, i) => {
          const instanceId = inst.nodeConfig.spaceId != null ? String(inst.nodeConfig.spaceId) : undefined
          return createPortal(
            <RootIdProvider value={inst.portalKey}>
              <ThemeProvider
                shadowRoot={inst.shadowRoot ?? null}
                hostElement={inst.hostElement}
                themeScopeSelector={inst.themeScopeSelector}
                allowPersistence={i === 0 && allowThemePersistence}
                defaultThemeId={inst.nodeConfig.theme}
                instanceId={instanceId}
                resolveWpThemeIds={resolveWpThemeIds}
              >
                <ThemedApp
                  props={inst.props}
                  isShadowDom={!!inst.shadowRoot}
                  shadowRootEl={inst.shadowRoot}
                />
              </ThemeProvider>
            </RootIdProvider>,
            inst.mountPoint,
            inst.portalKey,
          )
        })}
      </QueryClientProvider>
    </StrictMode>,
  )
}

const spacesAdminHost = document.getElementById('wpsg-spaces-admin')
const assetsAdminHost = document.getElementById('wpsg-assets-admin')
const rootHost = document.getElementById('root')
if (import.meta.env.DEV) {
  console.log('[WPSG] Mount init - rootHost:', rootHost, 'useShadowDom:', useShadowDom)
  console.log('[WPSG] All .wp-super-gallery elements:', document.querySelectorAll('.wp-super-gallery').length)
}

// P47-K: the WP-admin "Gallery Spaces" page mounts only the space-management UI
// (lazy-loaded so the admin chunk stays out of the public gallery path).
if (spacesAdminHost) {
  void import('./components/Admin/SpacesAdminApp').then(({ mountSpacesAdmin }) => {
    mountSpacesAdmin(spacesAdminHost)
  })
} else if (assetsAdminHost) {
  // P52-B: the WP-admin "Asset Library" page mounts only the global asset manager.
  void import('./components/Admin/GlobalAssetAdminApp').then(({ mountGlobalAssets }) => {
    mountGlobalAssets(assetsAdminHost)
  })
} else if (rootHost) {
  if (import.meta.env.DEV) console.log('[WPSG] Mounting to #root')
  const nodeConfig = parseNodeConfig(rootHost)
  const props = { ...parseProps(rootHost), spaceId: nodeConfig.spaceId, ...(nodeConfig.spaceName !== undefined && { spaceName: nodeConfig.spaceName }), ...(nodeConfig.instanceId !== undefined && { instanceId: nodeConfig.instanceId }), ...(nodeConfig.authBarMode !== undefined && { authBarMode: nodeConfig.authBarMode }) }
  const rootId = getRootId(rootHost)
  if (useShadowDom) {
    mountWithShadow(rootHost, props, rootId, nodeConfig)
  } else {
    import('./styles/global.scss')
    mountDefault(rootHost, props, rootId, nodeConfig)
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
      const nodeConfig = parseNodeConfig(node)
      const props = { ...parseProps(node), spaceId: nodeConfig.spaceId, ...(nodeConfig.spaceName !== undefined && { spaceName: nodeConfig.spaceName }), ...(nodeConfig.instanceId !== undefined && { instanceId: nodeConfig.instanceId }), ...(nodeConfig.authBarMode !== undefined && { authBarMode: nodeConfig.authBarMode }) }
      const rootId = getRootId(node, index)
      if (useShadowDom) {
        mountWithShadow(node, props, rootId, nodeConfig)
      } else {
        import('./styles/global.scss')
        mountDefault(node, props, rootId, nodeConfig)
      }
    })
  }
}
