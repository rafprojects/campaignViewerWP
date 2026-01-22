/// <reference types="vite/client" />

declare module '*.module.scss' {
  const classes: { [key: string]: string };
  export default classes;
}

declare module '*.scss?inline' {
  const content: string;
  export default content;
}

declare module '*.module.scss?inline' {
  const content: string;
  export default content;
}

interface Window {
  __USE_SHADOW_DOM__?: boolean;
  __WPSG_AUTH_PROVIDER__?: 'wp-jwt' | 'none';
  __WPSG_API_BASE__?: string;
}
