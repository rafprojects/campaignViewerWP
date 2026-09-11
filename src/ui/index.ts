/**
 * `@/ui`: the component boundary (P78-A).
 *
 * Every UI primitive the app renders is named here, and this file is the only
 * place outside the theme adapter that is allowed to reach for a Mantine
 * package. Application code imports from `@/ui`; ESLint forbids a direct
 * `@mantine/*` import anywhere else except the files on the allow-list in
 * `eslint-rules/mantine-boundary-allowlist.json`, which only shrinks.
 *
 * In this phase every name below is a thin re-export: no behaviour is
 * re-implemented and nothing renders differently. As the in-house framework
 * lands (Phase 79 onward) a name moves one line at a time from
 * `@mantine/core` to a sibling module in this directory, so the export list
 * doubles as the migration ledger.
 *
 * Mantine's theme plumbing is deliberately absent. `MantineProvider`,
 * `useMantineTheme`, `mergeThemeOverrides` and the other eight are adapter
 * concerns belonging to `src/themes/` and `src/portalTarget.ts`, not to the
 * component surface the framework inherits. See docs/PHASE78_REPORT.md.
 */

// ── Layout and typography ──────────────────────────────────────────────────
export {
  Anchor,
  Box,
  Card,
  Center,
  Container,
  Divider,
  Grid,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core';

// ── Inputs and controls ────────────────────────────────────────────────────
export {
  ActionIcon,
  Button,
  Checkbox,
  Chip,
  ColorInput,
  Combobox,
  CopyButton,
  FileButton,
  MultiSelect,
  NumberInput,
  PasswordInput,
  SegmentedControl,
  Select,
  Slider,
  Switch,
  TagsInput,
  Textarea,
  TextInput,
  UnstyledButton,
  useCombobox,
} from '@mantine/core';

// ── Overlays and navigation ────────────────────────────────────────────────
export {
  Accordion,
  Collapse,
  Drawer,
  Menu,
  Modal,
  Pagination,
  Popover,
  Tabs,
  Tooltip,
} from '@mantine/core';

// ── Feedback and data display ──────────────────────────────────────────────
export {
  Alert,
  Badge,
  ColorSwatch,
  Image,
  Kbd,
  Loader,
  Progress,
  Skeleton,
  Table,
} from '@mantine/core';

// ── Structural utilities ───────────────────────────────────────────────────
export {
  FocusTrap,
  NativeScrollArea,
  Portal,
  ScrollArea,
  Transition,
  VisuallyHidden,
} from '@mantine/core';

// ── Component types ────────────────────────────────────────────────────────
export type {
  ColorInputProps,
  DrawerProps,
  NumberInputProps,
  SelectProps,
} from '@mantine/core';

/**
 * Vendor-named types renamed at the boundary. Nothing imports `@/ui` yet, so
 * the framework's own names can be established now rather than after 154
 * consumers have spelled the Mantine ones.
 */
export type {
  MantineSize as UiSize,
  MantineTransition as UiTransition,
  Primitive as UiPrimitiveValue,
} from '@mantine/core';

// ── Hooks ──────────────────────────────────────────────────────────────────
export {
  getHotkeyHandler,
  useDebouncedValue,
  useDisclosure,
  useElementSize,
  useLocalStorage,
  useMediaQuery,
  useMergedRef,
} from '@mantine/hooks';

// ── Imperative surfaces ────────────────────────────────────────────────────
export { modals, ModalsProvider } from '@mantine/modals';
export { notifications, Notifications, showNotification } from '@mantine/notifications';
export { useForm } from '@mantine/form';
