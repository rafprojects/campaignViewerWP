import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { shadowStyles } from './shadowStyles'

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
      <App {...props} />
    </StrictMode>,
  )
}

const mountWithShadow = (host: HTMLElement, props: MountProps) => {
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
  renderApp(host, props)
}

const rootHost = document.getElementById('root')
if (rootHost) {
  const props = parseProps(rootHost)
  if (useShadowDom) {
    mountWithShadow(rootHost, props)
  } else {
    import('./styles/global.scss')
    mountDefault(rootHost, props)
  }
} else {
  const nodes = document.querySelectorAll<HTMLElement>('.wp-super-gallery')
  nodes.forEach((node) => {
    const props = parseProps(node)
    if (useShadowDom) {
      mountWithShadow(node, props)
    } else {
      import('./styles/global.scss')
      mountDefault(node, props)
    }
  })
}
