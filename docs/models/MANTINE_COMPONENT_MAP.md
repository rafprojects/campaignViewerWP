# Mantine Component Usage Map

Per-file reference of every Mantine component used across the CampaignViewer component tree.

---

## App.tsx

| Source | Components |
|---|---|
| `@mantine/core` | `Container`, `Alert`, `Loader`, `Center`, `Stack`, `Modal` |
| `@mantine/hooks` | `useDisclosure`, `useLocalStorage` |

```
App
└── Container
    └── Stack
        ├── Center > Loader                    (loading state)
        ├── Alert                              (error state)
        └── Modal                              (login, campaign edit, archive, external media)
```

---

## CardGallery.tsx

| Source | Components |
|---|---|
| `@mantine/core` | `Button`, `Container`, `Group`, `Stack`, `Title`, `Text`, `Tabs`, `SegmentedControl`, `Alert`, `Box`, `SimpleGrid`, `Center`, `Loader`, `TextInput`, `Switch`, `Select`, `ColorInput` |
| `@mantine/hooks` | `useMediaQuery` |

```
Container
└── Stack
    ├── Title                                  (gallery heading)
    ├── Text                                   (subtitle)
    ├── Group
    │   ├── TextInput                          (search)
    │   ├── Switch                             (access toggle)
    │   ├── Select                             (display mode picker)
    │   └── ColorInput                         (background color)
    ├── Tabs                                   (company filter tabs)
    │   ├── Tabs.List > Tabs.Tab (× N)
    │   └── Tabs.Panel
    ├── SegmentedControl                       (view mode: load-more/paginated/show-all)
    ├── Alert                                  (access notice)
    ├── Center > Loader                        (loading)
    ├── SimpleGrid                             (card grid)
    │   └── Box (× N, wraps each CampaignCard)
    └── Button                                 (load more / pagination)
```

---

## CampaignCard.tsx

| Source | Components |
|---|---|
| `@mantine/core` | `Card`, `Image`, `Badge`, `Group`, `Text`, `Box`, `Stack`, `UnstyledButton` |

```
UnstyledButton
└── Card
    ├── Card.Section
    │   └── Image                              (thumbnail)
    ├── Group
    │   ├── Badge (× N)                        (tags, access badge)
    │   └── Text                               (company name)
    ├── Stack
    │   ├── Text                               (title)
    │   └── Text                               (description)
    └── Box                                    (lock overlay wrapper)
```

---

## RequestAccessForm.tsx

| Source | Components |
|---|---|
| `@mantine/core` | `Box`, `Button`, `Text`, `TextInput`, `Stack`, `Alert` |

```
Box
└── Stack
    ├── Text                                   (prompt message)
    ├── TextInput                              (email input)
    ├── Button                                 (submit)
    └── Alert                                  (success/error feedback)
```

---

## CampaignViewer.tsx

| Source | Components |
|---|---|
| `@mantine/core` | `Modal`, `Image`, `Badge`, `Group`, `Stack`, `Title`, `Text`, `Paper`, `SimpleGrid`, `Box`, `Center`, `Loader`, `Switch` |
| `@mantine/hooks` | `useMediaQuery` |

```
Modal
└── Box (content wrapper)
    ├── Box (cover section)
    │   └── Image                              (cover image)
    ├── Group
    │   ├── Badge (× N)                        (tags, company)
    │   └── Switch                             (admin toggles)
    ├── Stack
    │   ├── Title                              (campaign title)
    │   └── Text                               (description / about)
    ├── SimpleGrid                             (stats section)
    │   └── Paper (× N)                        (stat cards)
    │       └── Stack > Text
    ├── Center > Loader                        (gallery loading)
    └── Stack                                  (gallery sections container)
```

---

## ImageCarousel.tsx

| Source | Components |
|---|---|
| `@mantine/core` | `Stack`, `Title`, `Group`, `ActionIcon`, `Image`, `Text`, `Box` |

```
Stack
├── Group
│   ├── Title                                  (section label)
│   └── ActionIcon (× 2)                       (prev / next fallback)
├── Box (viewport)
│   ├── Image                                  (current slide)
│   └── Text                                   (caption)
└── Group                                      (counter / info)
```

---

## VideoCarousel.tsx

| Source | Components |
|---|---|
| `@mantine/core` | `Stack`, `Title`, `Group`, `ActionIcon`, `Image`, `Text`, `Box` |

```
Stack
├── Group
│   ├── Title                                  (section label)
│   └── ActionIcon (× 2)                       (prev / next fallback)
├── Box (viewport)
│   ├── Image / iframe                         (video poster or embed)
│   └── Text                                   (caption)
└── Group
```

---

## Lightbox.tsx

| Source | Components |
|---|---|
| `@mantine/core` | `Portal`, `ActionIcon`, `Box`, `Stack`, `Text` |

```
Portal                                         (renders outside Modal DOM)
└── Box (fullscreen overlay)
    ├── ActionIcon                             (close button)
    ├── Box                                    (media container)
    │   └── Image / iframe
    ├── Stack
    │   └── Text                               (caption)
    └── [KeyboardHintOverlay]
```

---

## KeyboardHintOverlay.tsx

| Source | Components |
|---|---|
| `@mantine/core` | `Box`, `Group`, `Kbd`, `Text`, `Transition` |

```
Transition
└── Box
    └── Group
        ├── Kbd + Text                         (Esc → Close)
        ├── Kbd + Text                         (← → Navigate)
        └── ...
```

---

## OverlayArrows.tsx

**No Mantine components** — uses inline styles only.

---

## DotNavigator.tsx

**No Mantine components** — uses inline styles only.

---

## InContextEditor.tsx

| Source | Components |
|---|---|
| `@mantine/core` | `ActionIcon`, `Popover`, `ScrollArea`, `Box` |
| `@mantine/hooks` | `useDisclosure` |

```
Box (positioned container)
└── Popover
    ├── Popover.Target
    │   └── ActionIcon                         (gear icon)
    └── Popover.Dropdown
        └── ScrollArea
            └── [settings children]
```

---

## TypographyEditor.tsx

| Source | Components |
|---|---|
| `@mantine/core` | `Accordion`, `ColorInput`, `Group`, `NumberInput`, `Select`, `Stack`, `TextInput`, `ActionIcon`, `Text`, `Badge` |

```
Accordion
└── Accordion.Item (× N, per typography slot)
    └── Accordion.Panel
        └── Stack
            ├── Select                         (font family)
            ├── Group
            │   ├── NumberInput                (font size)
            │   ├── Select                     (font weight)
            │   └── ColorInput                 (font color)
            ├── NumberInput                    (line height)
            ├── TextInput                      (custom CSS)
            ├── ActionIcon                     (reset)
            └── Badge                          (preview)
```

---

## GradientEditor.tsx

| Source | Components |
|---|---|
| `@mantine/core` | `Box`, `Text`, `Stack`, `Group`, `Select`, `Slider`, `ColorInput`, `NumberInput`, `SegmentedControl`, `ActionIcon`, `Tooltip` |

```
Stack
├── SegmentedControl                           (gradient type: linear/radial/conic)
├── Select / NumberInput                       (direction / angle)
├── Group (× N, per color stop)
│   ├── ColorInput                             (stop color)
│   ├── Slider                                 (stop position %)
│   └── ActionIcon                             (remove stop)
│       └── Tooltip
├── ActionIcon                                 (add stop)
└── Box                                        (live preview swatch)
```

---

## CompanyLogo.tsx

| Source | Components |
|---|---|
| `@mantine/core` | `Image` |

```
Image                                          (company logo)
```

---

## UnifiedCampaignModal.tsx

| Source | Components |
|---|---|
| `@mantine/core` | `ActionIcon`, `Badge`, `Button`, `Card`, `Center`, `ColorInput`, `FileButton`, `Group`, `Image`, `Loader`, `Modal`, `Progress`, `Select`, `SimpleGrid`, `Stack`, `Tabs`, `TagsInput`, `Text`, `TextInput`, `Textarea`, `Tooltip` |
| `@mantine/hooks` | `useMediaQuery` |

```
Modal
└── Stack
    ├── Tabs
    │   ├── Tabs.List
    │   │   ├── Tabs.Tab (Details)
    │   │   ├── Tabs.Tab (Media)
    │   │   └── Tabs.Tab (Settings)
    │   ├── Tabs.Panel (Details)
    │   │   └── Stack
    │   │       ├── TextInput                  (title)
    │   │       ├── Textarea                   (description)
    │   │       ├── TagsInput                  (tags)
    │   │       ├── Select (× N)               (visibility, company)
    │   │       └── ColorInput                 (brand color)
    │   ├── Tabs.Panel (Media)
    │   │   └── Stack
    │   │       ├── SimpleGrid                 (media thumbnails)
    │   │       │   └── Card (× N)
    │   │       │       ├── Image
    │   │       │       ├── Badge              (type label)
    │   │       │       └── ActionIcon         (remove)
    │   │       ├── FileButton + Button        (upload)
    │   │       ├── Progress                   (upload bar)
    │   │       └── Center > Loader
    │   └── Tabs.Panel (Settings)
    │       └── Stack
    │           ├── Select                     (adapter picker)
    │           └── Group > Tooltip
    └── Group
        ├── Button (Cancel)
        └── Button (Save)
```

---

## Gallery Adapters

### CompactGridGallery.tsx
| `@mantine/core` | `Box`, `Group`, `Stack`, `Title` |

### JustifiedGallery.tsx
| `@mantine/core` | `Box`, `Stack`, `Title`, `Group` |

### MasonryGallery.tsx
| `@mantine/core` | `Box`, `Stack`, `Title`, `Group` |

### HexagonalGallery.tsx
| `@mantine/core` | `Box`, `Stack`, `Title`, `Group`, `Text` |

### CircularGallery.tsx
| `@mantine/core` | `Box`, `Stack`, `Title`, `Group`, `Text` |

### DiamondGallery.tsx
| `@mantine/core` | `Box`, `Stack`, `Title`, `Group`, `Text` |

### LayoutBuilderGallery.tsx
| `@mantine/core` | `Box`, `Center`, `Loader`, `Text`, `Stack` |

All adapters share a common Mantine shell:
```
Stack
├── Group
│   └── Title                                  (section label)
└── Box                                        (grid/layout container)
    ├── [LazyImage / media tiles] (× N)        (no Mantine — raw HTML/CSS)
    └── Center > Loader                        (loading fallback)
```

---

## LazyImage.tsx

**No Mantine components** — uses native `<img>` with IntersectionObserver.

---

## Mantine Components Index (sorted by frequency)

| Component | Files Using It |
|---|---|
| `Box` | 16 files |
| `Stack` | 15 files |
| `Text` | 14 files |
| `Group` | 13 files |
| `Title` | 9 files |
| `Button` | 4 files |
| `Image` | 5 files |
| `ActionIcon` | 6 files |
| `Badge` | 4 files |
| `Select` | 5 files |
| `ColorInput` | 4 files |
| `Modal` | 3 files |
| `Center` | 4 files |
| `Loader` | 4 files |
| `NumberInput` | 2 files |
| `Alert` | 3 files |
| `SimpleGrid` | 3 files |
| `Tabs` | 2 files |
| `TextInput` | 4 files |
| `Switch` | 2 files |
| `SegmentedControl` | 2 files |
| `Tooltip` | 2 files |
| `Card` | 2 files |
| `Container` | 2 files |
| `Paper` | 1 file |
| `Portal` | 1 file |
| `Popover` | 1 file |
| `ScrollArea` | 1 file |
| `Accordion` | 1 file |
| `Slider` | 1 file |
| `Transition` | 1 file |
| `Kbd` | 1 file |
| `FileButton` | 1 file |
| `Progress` | 1 file |
| `TagsInput` | 1 file |
| `Textarea` | 1 file |
| `UnstyledButton` | 1 file |
