import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/global.scss'
import { shadowStyles } from './shadowStyles'

const host = document.getElementById('root')

if (!host) {
  throw new Error('Root element not found')
}

const query = new URLSearchParams(window.location.search)
const windowFlag = (window as Window & { __USE_SHADOW_DOM__?: boolean }).__USE_SHADOW_DOM__
const useShadowDom = windowFlag ?? query.get('shadow') !== '0'

if (useShadowDom) {
  const shadowRoot = host.attachShadow({ mode: 'open' })
  const styleTag = document.createElement('style')
  styleTag.textContent = shadowStyles
  shadowRoot.appendChild(styleTag)

  const mountPoint = document.createElement('div')
  shadowRoot.appendChild(mountPoint)

  createRoot(mountPoint).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
} else {
  createRoot(host).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
