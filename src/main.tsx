import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { shadowStyles } from './shadowStyles'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { ModalsProvider } from '@mantine/modals'
import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import { startWebVitalsMonitoring } from './services/monitoring/webVitals'
import { initSentry } from './services/monitoring/sentry'
import { ThemeProvider } from './contexts/ThemeContext'
import { useTheme } from './hooks/useTheme'

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

if ('serviceWorker' in navigator && !import.meta.env.DEV) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .catch((error) => {
        // eslint-disable-next-line no-console
        console.error('Service worker registration failed:', error);
      });
  });
}

const parseProps = (node: Element): MountProps => {
  const raw = node.getAttribute('data-wpsg-props')
  if (!raw) return {}
  try {
    return JSON.parse(raw) as MountProps
  } catch {
    return {}
  }
}

/**
 * Inner shell that consumes the ThemeContext and feeds the resolved
 * MantineThemeOverride into MantineProvider. This component re-renders
 * only when the theme changes (O(1) map lookup, pre-computed objects).
 */
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
      // Portal targets (modals, tooltips) render inside shadow root
      getRootElement={() =>
        isShadowDom && shadowRootEl
          ? (shadowRootEl.querySelector('[data-wpsg-mount]') as HTMLElement) ?? document.body
          : document.body
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
  props: MountProps,
  shadowRootEl?: ShadowRoot,
) => {
  const isShadow = !!shadowRootEl

  createRoot(mountNode).render(
    <StrictMode>
      <ThemeProvider shadowRoot={shadowRootEl ?? null} allowPersistence={allowThemePersistence}>
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
  renderApp(mountPoint, props, shadowRoot)
}

const mountDefault = (host: HTMLElement, props: MountProps) => {
  // Prevent double mounting
  if (host.hasAttribute('data-wpsg-mounted')) {
    return
  }
  host.setAttribute('data-wpsg-mounted', 'true')
  renderApp(host, props)
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
