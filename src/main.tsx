import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { shadowStyles } from './shadowStyles'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { ModalsProvider } from '@mantine/modals'
import { theme } from './theme'
import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'

type MountProps = Record<string, unknown>

const query = new URLSearchParams(window.location.search)
const windowFlag = (window as Window & { __USE_SHADOW_DOM__?: boolean }).__USE_SHADOW_DOM__
const useShadowDom = windowFlag ?? query.get('shadow') !== '0'

const parseProps = (node: Element): MountProps => {
  const raw = node.getAttribute('data-wpsg-props')
  if (!raw) return {}
  try {
    return JSON.parse(raw) as MountProps
  } catch {
    return {}
  }
}

const renderApp = (mountNode: Element, props: MountProps) => {
  createRoot(mountNode).render(
    <StrictMode>
      <MantineProvider theme={theme}>
        <Notifications />
        <ModalsProvider>
          <App {...props} />
        </ModalsProvider>
      </MantineProvider>
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
  shadowRoot.appendChild(mountPoint)
  renderApp(mountPoint, props)
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
console.log('[WPSG] Mount init - rootHost:', rootHost, 'useShadowDom:', useShadowDom)
console.log('[WPSG] All .wp-super-gallery elements:', document.querySelectorAll('.wp-super-gallery').length)

if (rootHost) {
  console.log('[WPSG] Mounting to #root')
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
  console.log('[WPSG] No #root, mounting to', nodes.length, '.wp-super-gallery elements')
  nodes.forEach((node, index) => {
    console.log('[WPSG] Processing node', index, '- already mounted:', node.hasAttribute('data-wpsg-mounted'))
    const props = parseProps(node)
    if (useShadowDom) {
      mountWithShadow(node, props)
    } else {
      import('./styles/global.scss')
      mountDefault(node, props)
    }
  })
}
