import type { MantineThemeOverride } from '@mantine/core'

/**
 * Custom Mantine theme configuration
 * Maps design tokens to Mantine component styles
 */

export const theme: MantineThemeOverride = {
  // Color scheme - dark mode (slate/dark blue palette)
  colors: {
    dark: [
      '#c1c2c5', // 0
      '#a6a7ab', // 1
      '#909296', // 2
      '#5c5d66', // 3
      '#373a40', // 4
      '#2c2e33', // 5
      '#25262b', // 6 - surface-2 equivalent
      '#1e293b', // 7 - surface equivalent
      '#101113', // 8
      '#0c0d12', // 9
    ],
  },

  // Primary color palette - blue (matches --color-accent: #3b82f6)
  primaryColor: 'blue',
  primaryShade: { light: 6, dark: 5 },

  // Typography
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
  fontFamilyMonospace:
    "'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'source-code-pro', 'monospace'",

  fontSizes: {
    xs: '0.75rem',
    sm: '0.875rem',
    md: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
  },

  headings: {
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif",
    sizes: {
      h1: {
        fontSize: '2rem',
        lineHeight: '1.2',
      },
      h2: {
        fontSize: '1.5rem',
        lineHeight: '1.3',
      },
      h3: {
        fontSize: '1.25rem',
        lineHeight: '1.4',
      },
      h4: {
        fontSize: '1.125rem',
        lineHeight: '1.4',
      },
      h5: {
        fontSize: '1rem',
        lineHeight: '1.5',
      },
      h6: {
        fontSize: '0.875rem',
        lineHeight: '1.5',
      },
    },
  },

  // Spacing scale
  spacing: {
    xs: '0.5rem', // 8px
    sm: '0.75rem', // 12px
    md: '1rem', // 16px
    lg: '1.5rem', // 24px
    xl: '2rem', // 32px
  },

  // Border radius (maps to --radius-* tokens)
  radius: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
  },

  // Shadows (maps to --shadow-* tokens)
  shadows: {
    xs: '0 2px 4px rgba(0, 0, 0, 0.15)',
    sm: '0 4px 8px rgba(0, 0, 0, 0.2)',
    md: '0 10px 30px rgba(0, 0, 0, 0.25)', // --shadow-soft
    lg: '0 20px 45px rgba(0, 0, 0, 0.35)', // --shadow-card
    xl: '0 25px 50px rgba(0, 0, 0, 0.4)',
  },

  // Breakpoints
  breakpoints: {
    xs: '320px',
    sm: '576px',
    md: '768px',
    lg: '992px',
    xl: '1200px',
  },

  // Component-specific styles
  components: {
    // Button styles
    Button: {
      defaultProps: {
        fw: 500,
      },
      styles: {
        root: {
          textTransform: 'none',
          '&:focus-visible': {
            outline: '2px solid #60a5fa',
            outlineOffset: 2,
          },
          transition: 'background-color 150ms ease, box-shadow 150ms ease, transform 150ms ease',
          '&:hover': {
            boxShadow: '0 6px 16px rgba(15, 23, 42, 0.35)',
          },
          '&:active': {
            transform: 'translateY(1px)',
          },
        },
      },
    },

    // Card styles
    Card: {
      styles: {
        root: {
          backgroundColor: '#1e293b', // --color-surface
          borderColor: '#334155', // --color-border
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.25)', // --shadow-soft
        },
      },
    },

    // Input styles
    Input: {
      styles: {
        input: {
          backgroundColor: '#0f172a', // --color-bg
          borderColor: '#334155', // --color-border
          color: '#ffffff', // --color-text
          '&:focus': {
            borderColor: '#3b82f6', // --color-accent
          },
          '&:focus-visible': {
            outline: '2px solid rgba(59, 130, 246, 0.6)',
            outlineOffset: 1,
          },
        },
      },
    },

    // TextInput styles
    TextInput: {
      styles: {
        input: {
          backgroundColor: '#0f172a',
          borderColor: '#334155',
          color: '#ffffff',
          '&:focus': {
            borderColor: '#3b82f6',
          },
          '&:focus-visible': {
            outline: '2px solid rgba(59, 130, 246, 0.6)',
            outlineOffset: 1,
          },
        },
        label: {
          color: '#ffffff',
          fontWeight: 500,
        },
      },
    },

    // PasswordInput styles
    PasswordInput: {
      styles: {
        input: {
          backgroundColor: '#0f172a',
          borderColor: '#334155',
          color: '#ffffff',
          '&:focus': {
            borderColor: '#3b82f6',
          },
          '&:focus-visible': {
            outline: '2px solid rgba(59, 130, 246, 0.6)',
            outlineOffset: 1,
          },
        },
        label: {
          color: '#ffffff',
          fontWeight: 500,
        },
      },
    },

    // Modal styles
    Modal: {
      defaultProps: {
        transitionProps: { transition: 'fade', duration: 160 },
      },
      styles: {
        root: {
          '--modal-z-index': '100',
        },
        content: {
          backgroundColor: '#1e293b', // --color-surface
          borderColor: '#334155', // --color-border
        },
        header: {
          backgroundColor: '#1e293b',
          borderColor: '#334155',
        },
        title: {
          color: '#ffffff',
          fontWeight: 600,
        },
      },
    },

    // ActionIcon styles
    ActionIcon: {
      defaultProps: {
        radius: 'md',
      },
      styles: {
        root: {
          '&:focus-visible': {
            outline: '2px solid rgba(59, 130, 246, 0.6)',
            outlineOffset: 2,
          },
          transition: 'transform 150ms ease, background-color 150ms ease',
          '&:active': {
            transform: 'translateY(1px)',
          },
        },
      },
    },

    // Badge styles
    Badge: {
      defaultProps: {
        fw: 500,
      },
      styles: {
        root: {
          backgroundColor: 'rgba(59, 130, 246, 0.18)', // blue with opacity
          color: '#bfdbfe',
          borderColor: 'rgba(59, 130, 246, 0.5)',
        },
      },
    },

    // Alert styles
    Alert: {
      styles: {
        root: {
          backgroundColor: 'rgba(59, 130, 246, 0.12)',
          borderColor: 'rgba(59, 130, 246, 0.6)',
          color: '#e2e8f0',
        },
      },
    },

    // Paper styles
    Paper: {
      styles: {
        root: {
          backgroundColor: '#1e293b', // --color-surface
          borderColor: '#334155', // --color-border
        },
      },
    },

    // Group styles (just spacing)
    Group: {
      defaultProps: {
        gap: 'md',
      },
    },

    // Tabs styles
    Tabs: {
      styles: {
        tab: {
          color: '#94a3b8', // --color-muted
          '&[data-active]': {
            color: '#3b82f6', // --color-accent
            borderColor: '#3b82f6',
          },
          '&:focus-visible': {
            outline: '2px solid rgba(59, 130, 246, 0.6)',
            outlineOffset: 2,
          },
        },
      },
    },

    // Table styles
    Table: {
      styles: {
        table: {
          borderColor: '#334155',
        },
        thead: {
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
        },
        th: {
          color: '#e2e8f0',
          borderColor: '#334155',
        },
        td: {
          borderColor: '#334155',
          color: '#e2e8f0',
        },
        tr: {
          '&[data-hover]': {
            backgroundColor: 'rgba(148, 163, 184, 0.08)',
          },
        },
      },
    },

    // SegmentedControl styles
    SegmentedControl: {
      styles: {
        root: {
          backgroundColor: 'rgba(148, 163, 184, 0.12)',
          borderColor: 'rgba(148, 163, 184, 0.35)',
        },
        control: {
          color: '#94a3b8',
          '&[data-active]': {
            backgroundColor: '#3b82f6',
            color: '#ffffff',
          },
          '&:focus-visible': {
            outline: '2px solid rgba(59, 130, 246, 0.6)',
            outlineOffset: 2,
          },
        },
      },
    },

    // Container styles
    Container: {
      defaultProps: {
        size: 'xl',
      },
      styles: {
        root: {
          maxWidth: '80rem', // 1280px
        },
      },
    },

    // Loader styles
    Loader: {
      defaultProps: {
        color: 'blue',
      },
    },
  },

  // Global dark mode overrides
  other: {
    bodyBackground: '#0f172a', // --color-bg
  },
}

export default theme
