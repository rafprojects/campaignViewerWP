# Phase 23 Mantine Component Map

An up-to-date Mantine usage map for the current Phase 23 UI surface.

This supplements the older MANTINE_COMPONENT_MAP.md. The older map is still useful for the original viewer path, but it does not reflect the current settings subsystem, admin data-table flows, campaign edit surface, or layout-builder tooling.

---

## Scope

This map tracks the main runtime UI surfaces that materially shape the current Mantine footprint:

1. app shell and auth
2. campaign gallery and viewer
3. campaign editing
4. settings subsystem
5. admin subsystem
6. layout-builder subsystem
7. shared editors and helpers

Test-only imports are intentionally excluded.

---

## App Shell

### App.tsx

| Source | Components |
|---|---|
| @mantine/core | Container, Alert, Loader, Center, Stack, Modal |
| @mantine/hooks | useDisclosure, useLocalStorage |

### ErrorBoundary.tsx

| Source | Components |
|---|---|
| @mantine/core | Alert, Button, Stack, Text |

---

## Auth Surface

### AuthBar.tsx

| Source | Components |
|---|---|
| @mantine/core | Box, Container, Group, Button, Tooltip, ActionIcon, Text, Menu |
| @mantine/hooks | useMediaQuery |

### AuthBarFloating.tsx

| Source | Components |
|---|---|
| @mantine/core | ActionIcon, Popover, Stack, Text, Button, Divider, Group |

### AuthBarMinimal.tsx

| Source | Components |
|---|---|
| @mantine/core | Box, Container, Group, Text, Menu, ActionIcon |

### LoginForm.tsx

| Source | Components |
|---|---|
| @mantine/core | TextInput, PasswordInput, Button, Paper, Title, Text, Stack, Alert |

---

## Campaign Gallery And Viewer

### CardGallery.tsx

| Source | Components |
|---|---|
| @mantine/core | Button, Container, Group, Stack, Title, Text, Tabs, SegmentedControl, Alert, Box, SimpleGrid, Center, Loader, TextInput, Switch, Select, ColorInput |
| @mantine/hooks | useMediaQuery |

### CampaignCard.tsx

| Source | Components |
|---|---|
| @mantine.core | Card, Image, Badge, Group, Text, Box, Stack, UnstyledButton |

### RequestAccessForm.tsx

| Source | Components |
|---|---|
| @mantine/core | Box, Button, Text, TextInput, Stack, Alert |

### CampaignViewer.tsx

| Source | Components |
|---|---|
| @mantine/core | Modal, Image, Badge, Group, Stack, Title, Text, Paper, SimpleGrid, Box, Center, Loader, Switch |
| @mantine/hooks | useMediaQuery |

### PerTypeGallerySection.tsx

| Source | Components |
|---|---|
| @mantine/core | SimpleGrid, Stack |

### GallerySectionWrapper.tsx

| Source | Components |
|---|---|
| @mantine/core | Box |

---

## Shared Gallery And Adapter Surface

### MediaCarouselAdapter.tsx

| Source | Components |
|---|---|
| @mantine/core | Stack, Title, Group, ActionIcon, Image, Text, Box |

### Lightbox.tsx

| Source | Components |
|---|---|
| @mantine/core | Portal, ActionIcon, Box, Stack, Text |

### KeyboardHintOverlay.tsx

| Source | Components |
|---|---|
| @mantine/core | Box, Group, Kbd, Text, Transition |

### Adapter galleries

| File group | Components |
|---|---|
| CompactGridGallery, JustifiedGallery, MasonryGallery | Box, Group, Stack, Title |
| CircularGallery, DiamondGallery, HexagonalGallery | Box, Group, Stack, Title, Text |
| LayoutBuilderGallery | Box, Center, Loader, Text, Stack |

---

## Campaign Editing

### UnifiedCampaignModal.tsx

| Source | Components |
|---|---|
| @mantine/core | ActionIcon, Badge, Button, Card, Center, ColorInput, FileButton, Group, Image, Loader, Modal, Progress, Select, SimpleGrid, Stack, Tabs, TagsInput, Text, TextInput, Textarea, Tooltip |
| @mantine/hooks | useMediaQuery |

### MediaLibraryPicker.tsx

| Source | Components |
|---|---|
| @mantine/core | Badge, Button, Card, Center, Group, Image, Loader, SimpleGrid, Stack, Text, TextInput |

### AddExternalMediaModal.tsx

| Source | Components |
|---|---|
| @mantine/core | Button, Group, Modal, Select, Stack, TextInput |

### ArchiveCampaignModal.tsx

| Source | Components |
|---|---|
| @mantine/core | Button, Group, Modal, Stack, Text |

### ConfirmModal.tsx

| Source | Components |
|---|---|
| @mantine/core | Button, Group, Modal, Stack, Text |

---

## Shared Editors

### InContextEditor.tsx

| Source | Components |
|---|---|
| @mantine/core | ActionIcon, Popover, ScrollArea, Box |
| @mantine/hooks | useDisclosure |

### TypographyEditor.tsx

| Source | Components |
|---|---|
| @mantine/core | Accordion, ColorInput, Group, NumberInput, Select, Stack, TextInput, ActionIcon, Text, Badge |

### GradientEditor.tsx

| Source | Components |
|---|---|
| @mantine/core | Box, Text, Stack, Group, Select, Slider, ColorInput, NumberInput, SegmentedControl, ActionIcon, Tooltip |

### GalleryConfigEditorModal.tsx

| Source | Components |
|---|---|
| @mantine/core | Button, ColorInput, Divider, Group, Modal, NumberInput, Select, Stack, Tabs, Text, TextInput |

---

## Settings Subsystem

### SettingsPanel.tsx

| Source | Components |
|---|---|
| @mantine/core | Accordion, Box, Button, Group, Stack, Loader, Center, Title, Modal, NativeScrollArea, Tabs |
| @mantine/hooks | useMediaQuery |

### GeneralSettingsSection.tsx

| Source | Components |
|---|---|
| @mantine/core | ColorInput, Divider, NumberInput, Select, Stack, Switch |

### MediaDisplaySettingsSection.tsx

| Source | Components |
|---|---|
| @mantine/core | Accordion, ColorInput, Divider, Group, NumberInput, Select, Slider, Stack, Switch, Text, TextInput |

### GalleryLayoutSettingsSection.tsx

| Source | Components |
|---|---|
| @mantine/core | Accordion, Button, Group, Text |

### CampaignViewerSettingsSection.tsx

| Source | Components |
|---|---|
| @mantine/core | Box, ColorInput, Divider, NumberInput, Select, Slider, Stack, Switch, Text |

### CampaignCardSettingsSection.tsx

| Source | Components |
|---|---|
| @mantine/core | Accordion, ColorInput, Divider, NumberInput, Select, Stack, Switch |

### AdvancedSettingsSection.tsx

| Source | Components |
|---|---|
| @mantine/core | Accordion, Divider, NumberInput, Slider, Stack, Switch, Text, TextInput |

### TypographySettingsSection.tsx

| Source | Components |
|---|---|
| @mantine/core | Accordion, Button, Divider, Stack, Text |

### Supporting settings sections

| File group | Components |
|---|---|
| GalleryLayoutDetailSections.tsx | Accordion, Divider, NumberInput, Select, Stack, Switch |
| GalleryPresentationSections.tsx | Accordion, ColorInput, Select, Stack, Switch, TextInput |
| GalleryAdapterSettingsSection.tsx | Box, ColorInput, Group, NumberInput, Select, SegmentedControl, SimpleGrid, Stack, Switch, Text, TextInput |

---

## Admin Subsystem

### AdminPanel.tsx

| Source | Components |
|---|---|
| @mantine/core | Tabs, Button, Group, Card, Title, ActionIcon, Center, Loader, Chip, Tooltip |
| @mantine/hooks | useLocalStorage |

### CampaignsTab.tsx

| Source | Components |
|---|---|
| @mantine/core | Group, Pagination, Skeleton, Table, Text, Checkbox, Button, Tooltip |

### MediaTab.tsx

| Source | Components |
|---|---|
| @mantine/core | Button, Grid, Image, Text, Group, SegmentedControl, Table, Box, ActionIcon, Tooltip, Card, Badge, Pagination, Skeleton, Switch |

### AccessTab.tsx

| Source | Components |
|---|---|
| @mantine/core | ComboboxStore type plus a larger table/form surface |

### AuditTab.tsx

| Source | Components |
|---|---|
| @mantine/core | Group, ScrollArea, Skeleton, Table, Text |

### AnalyticsDashboard.tsx

| Source | Components |
|---|---|
| @mantine/core | Stack, Group, Text, Title, Select, SegmentedControl, Paper, SimpleGrid, Center, Loader, Alert |

### Common admin helpers

| File | Components |
|---|---|
| BulkActionsBar.tsx | Button, Group, Text, Paper, ActionIcon, Tooltip |
| MediaCard.tsx | Card, Image, Text, Group, Box, ActionIcon, Badge |
| MediaUsageBadge.tsx | Badge, Popover, Stack, Text, Anchor, Loader, Alert |
| SettingTooltip.tsx | Tooltip, ActionIcon, Group |
| KeyboardShortcutsModal.tsx | Modal, Table, Text, Stack, Badge, Group |

### Admin modal set

| File group | Components |
|---|---|
| MediaEditModal, MediaAddModal, MediaLightboxModal | Modal, Button, Group, Stack, Text, TextInput, Textarea, ActionIcon, Image |
| CampaignDuplicateModal, CampaignImportModal | Modal plus form-heavy input/button/group stacks |
| AdminCampaignArchiveModal, AdminCampaignRestoreModal | confirmation-modal patterns |
| ArchiveCompanyModal | Alert, Box, Checkbox, ScrollArea, Stack, Text |
| QuickAddUserModal | Button, Checkbox, Group, Modal, Stack, Text, TextInput |

---

## Layout Builder Subsystem

### LayoutBuilderModal shell

The layout-builder subtree is now a significant Mantine surface in its own right.

Core files include:

1. LayoutBuilderModal.tsx
2. LayoutBuilderCanvasPanel.tsx
3. LayoutBuilderMediaPanel.tsx
4. LayoutBuilderLayersPanel.tsx
5. LayoutBuilderPropertiesPanel.tsx
6. BuilderHistoryPanel.tsx
7. SlotPropertiesPanel.tsx
8. GraphicLayerPropertiesPanel.tsx
9. BackgroundPropertiesPanel.tsx
10. MaskPropertiesPanel.tsx

Common Mantine primitives across that subsystem:

1. Box
2. Group
3. Stack
4. Text
5. NumberInput
6. Slider
7. Switch
8. Button
9. Divider
10. ActionIcon
11. Tooltip
12. ScrollArea
13. Modal
14. Card

---

## Biggest Differences From The Older Map

1. The older doc is viewer-centric; the current Mantine footprint is now equally defined by SettingsPanel, AdminPanel, MediaTab, CampaignsTab, and layout-builder tooling.
2. New heavily used primitives now matter to the project-wide picture: Tabs, Table, Pagination, Skeleton, Chip, Divider, Slider, NativeScrollArea, Menu, PasswordInput, Grid, Anchor, and Checkbox.
3. The responsive gallery-config editor is now a first-class shared Mantine modal surface used by both settings and campaign editing.
4. The admin subsystem now contains a broader lazy modal ecosystem than the older map documents.

---

## Source Files

Primary files reflected in this map:

1. src/App.tsx
2. src/components/Auth/*.tsx
3. src/components/CampaignGallery/*.tsx
4. src/components/CardViewer/*.tsx
5. src/components/Galleries/Shared/*.tsx
6. src/components/Galleries/Adapters/**/*.tsx
7. src/components/Campaign/*.tsx
8. src/components/Common/*.tsx
9. src/components/Admin/*.tsx
10. src/components/Admin/LayoutBuilder/*.tsx
11. src/components/Settings/*.tsx