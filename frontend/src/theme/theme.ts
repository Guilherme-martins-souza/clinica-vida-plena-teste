import {
  Button,
  Card,
  createTheme,
  Input,
  SegmentedControl,
  Table,
  type CSSVariablesResolver,
  type MantineColorsTuple,
} from '@mantine/core'

// Tons da cor da marca (#0b6e66 no índice 6). O Mantine exige 10 tons para a cor principal,
// mas as variáveis abaixo (cssVariablesResolver) fazem os componentes usarem os tokens,
// que trocam sozinhos entre tema claro e escuro.
const brand: MantineColorsTuple = [
  '#e6f5f3',
  '#cdeae6',
  '#9fd5ce',
  '#6dc0b6',
  '#43ada1',
  '#1f8f84',
  '#0b6e66',
  '#08544e',
  '#063f3a',
  '#032a27',
]

export const theme = createTheme({
  primaryColor: 'brand',
  colors: { brand },
  fontFamily: "'Figtree Variable', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
  fontFamilyMonospace: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
  headings: {
    fontFamily: "'Figtree Variable', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
    fontWeight: '600',
  },

  // Os pontos de quebra seguem o design system: 720px (menu só com ícones) e 1080px (grades com menos colunas).
  breakpoints: {
    xs: '36em', // 576px
    sm: '45em', // 720px
    md: '67.5em', // 1080px
    lg: '75em', // 1200px
    xl: '88em', // 1408px
  },

  // Escala de espaçamento do design system (space-2 a space-6), em rem.
  spacing: {
    xs: '0.5rem', // 8px
    sm: '0.75rem', // 12px
    md: '1rem', // 16px
    lg: '1.25rem', // 20px
    xl: '1.5rem', // 24px
  },
  radius: {
    xs: '0.25rem',
    sm: '0.375rem', // 6px
    md: '0.5rem', // 8px
    lg: '0.75rem', // 12px
    xl: '1rem',
  },
  defaultRadius: 'md',

  // Texto base de 14px; md é o tamanho padrão do Mantine.
  fontSizes: {
    xs: '0.75rem', // 12px, notas
    sm: '0.8125rem', // 13px, rótulos
    md: '0.875rem', // 14px, corpo
    lg: '1rem', // 16px, título de cartão
    xl: '1.5rem', // 24px, título da página
  },
  lineHeights: {
    xs: '1.34',
    sm: '1.39',
    md: '1.43',
    lg: '1.5',
    xl: '1.34',
  },

  components: {
    Card: Card.extend({
      defaultProps: { withBorder: true, radius: 'lg', padding: 'lg' },
      styles: { root: { backgroundColor: 'var(--surface)', borderColor: 'var(--line)' } },
    }),
    Button: Button.extend({
      defaultProps: { variant: 'default', size: 'sm' },
      styles: { root: { fontWeight: 500 } },
    }),
    Input: Input.extend({
      styles: {
        input: {
          backgroundColor: 'var(--surface)',
          borderColor: 'var(--line-strong)',
          color: 'var(--ink)',
        },
      },
    }),
    SegmentedControl: SegmentedControl.extend({
      styles: {
        root: { backgroundColor: 'var(--surface-sunken)' },
        indicator: { backgroundColor: 'var(--surface)', boxShadow: '0 0 0 1px var(--line)' },
      },
    }),
    Table: Table.extend({
      vars: () => ({ table: { '--table-border-color': 'var(--line)' } }),
    }),
  },
})

// Liga as variáveis internas do Mantine aos tokens do design system.
// Como os tokens já mudam com o tema, o mesmo mapa serve para claro e escuro.
const tokenVariables = {
  '--mantine-color-body': 'var(--bg)',
  '--mantine-color-text': 'var(--ink)',
  '--mantine-color-bright': 'var(--ink)',
  '--mantine-color-dimmed': 'var(--ink-muted)',
  '--mantine-color-placeholder': 'var(--ink-muted)',
  '--mantine-color-anchor': 'var(--brand)',
  '--mantine-color-error': 'var(--danger)',
  '--mantine-color-default': 'var(--surface)',
  '--mantine-color-default-hover': 'var(--surface-sunken)',
  '--mantine-color-default-color': 'var(--ink)',
  '--mantine-color-default-border': 'var(--line-strong)',
  '--mantine-primary-color-filled': 'var(--brand)',
  '--mantine-primary-color-filled-hover': 'var(--brand-strong)',
  '--mantine-primary-color-light': 'var(--brand-soft)',
  '--mantine-primary-color-light-hover': 'var(--brand-soft)',
  '--mantine-primary-color-light-color': 'var(--brand)',
  '--mantine-primary-color-contrast': 'var(--on-brand)',
  '--mantine-color-brand-filled': 'var(--brand)',
  '--mantine-color-brand-filled-hover': 'var(--brand-strong)',
  '--mantine-color-brand-light': 'var(--brand-soft)',
  '--mantine-color-brand-light-hover': 'var(--brand-soft)',
  '--mantine-color-brand-light-color': 'var(--brand)',
  '--mantine-color-brand-text': 'var(--brand)',
}

export const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {},
  light: tokenVariables,
  dark: tokenVariables,
})
