// @wp-super-gallery/theme-engine — framework-neutral theme pipeline.
//
// [P51-L] The portable core extracted from src/themes: type definitions, the
// chroma-based color generator, the strict validator, the CSS-variable emitter
// (parametrized prefix), and the 23 bundled theme JSONs. The Mantine adapter
// (`adaptTheme`) and the registry that composes these into MantineThemeOverride
// objects stay app-side (src/themes/{adapter,index}.ts).

export * from './types'
export * from './colorGen'
export * from './validation'
export * from './cssVariables'
export * from './bundledThemes'
