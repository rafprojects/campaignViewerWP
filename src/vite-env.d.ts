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
