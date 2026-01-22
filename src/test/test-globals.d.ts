declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => void | Promise<void>) => void;
declare const expect: (...args: unknown[]) => any;

declare module '@testing-library/react' {
  export const render: (...args: unknown[]) => any;
  export const screen: any;
  export const fireEvent: any;
}

declare module '@testing-library/jest-dom/vitest';
