# Mantine Main UI Assessment & Migration Plan

This document provides a comprehensive assessment of the current (non‑admin) UI and detailed migration specifications for moving to Mantine. Each component includes exact replacement mappings, implementation steps, and risk analysis.

**Status:** Phase 4 Work Item #1 — Assessment Complete

---

## Executive Summary

The main UI consists of **8 components** requiring migration across **4 categories**:
- **Gallery** (2 components): CardGallery, CampaignCard
- **Campaign** (3 components): CampaignViewer, VideoCarousel, ImageCarousel
- **Auth** (1 component): LoginForm
- **App Shell** (2 areas): App.tsx layout, global styles

**Estimated Total Effort:** 6-8 weeks
**Risk Level:** Medium (custom animations and styling require careful preservation)

---

## Complete Component Inventory

### Components Requiring Full Migration

| Component | File | Current Styling | Mantine Replacement | Effort | Priority |
|-----------|------|-----------------|---------------------|--------|----------|
| LoginForm | `src/components/Auth/LoginForm.tsx` | SCSS Module | TextInput, PasswordInput, Button, Paper | Low | 1 (Start) |
| CardGallery | `src/components/Gallery/CardGallery.tsx` | SCSS Module + framer-motion | Container, Group, SegmentedControl, Tabs, SimpleGrid | Medium | 2 |
| CampaignCard | `src/components/Gallery/CampaignCard.tsx` | SCSS Module + framer-motion | Card, Badge, Image, Box | Medium | 3 |
| CampaignViewer | `src/components/Campaign/CampaignViewer.tsx` | SCSS Module + framer-motion | Modal, Paper, Group, Stack, SimpleGrid, Button | High | 4 |
| VideoCarousel | `src/components/Campaign/VideoCarousel.tsx` | SCSS Module + framer-motion | @mantine/carousel or custom | High | 5 |
| ImageCarousel | `src/components/Campaign/ImageCarousel.tsx` | SCSS Module + framer-motion | @mantine/carousel, Lightbox pattern | High | 6 |
| App.tsx (layout) | `src/App.tsx` | Global SCSS classes | Container, Group, Alert, AppShell | Low | 7 |
| Global Styles | `src/styles/global.scss` | CSS Variables | Mantine Theme Provider | Low | 8 |

### Files To Be Deprecated After Migration

| File | Replacement |
|------|-------------|
| `src/components/Auth/LoginForm.module.scss` | Mantine component styles |
| `src/components/Gallery/CardGallery.module.scss` | Mantine component styles + custom overrides |
| `src/components/Gallery/CampaignCard.module.scss` | Mantine Card + custom styles prop |
| `src/components/Campaign/CampaignViewer.module.scss` | Mantine Modal + custom styles |
| `src/components/Campaign/VideoCarousel.module.scss` | Mantine Carousel + custom styles |
| `src/components/Campaign/ImageCarousel.module.scss` | Mantine Carousel + custom styles |
| `src/styles/global.scss` | Partial — keep container utilities, move colors to theme |
| `src/styles/_tokens.scss` | Map to Mantine theme colors |

---

## Detailed Migration Specifications

### 1. LoginForm.tsx — Priority 1 (Start Here)

**Current Implementation:**
```tsx
// Uses native HTML form elements with SCSS module styling
<form className={styles.form}>
  <input type="email" ... />
  <input type="password" ... />
  <button type="submit">Sign in</button>
</form>
```

**Mantine Replacement:**
```tsx
import { TextInput, PasswordInput, Button, Paper, Title, Text, Stack, Alert } from '@mantine/core';

<Paper p="xl" radius="md" withBorder>
  <Stack>
    <Title order={2}>Sign in</Title>
    <Text c="dimmed" size="sm">Access private campaigns with your WordPress account.</Text>
    <TextInput label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
    <PasswordInput label="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
    {error && <Alert color="red">{error}</Alert>}
    <Button type="submit" loading={isSubmitting} fullWidth>Sign in</Button>
  </Stack>
</Paper>
```

**Migration Steps:**
1. Import Mantine components: `TextInput`, `PasswordInput`, `Button`, `Paper`, `Title`, `Text`, `Stack`, `Alert`
2. Replace `<form className={styles.form}>` with `<Paper p="xl" radius="md" withBorder>`
3. Replace `<input type="email">` with `<TextInput label="Email" ... />`
4. Replace `<input type="password">` with `<PasswordInput label="Password" ... />`
5. Replace `<button>` with `<Button loading={isSubmitting}>` 
6. Replace error paragraph with `<Alert color="red">`
7. Remove `LoginForm.module.scss` import

**Breaking Changes:** None — API remains identical
**Risk Level:** Low
**Effort:** 1-2 hours

---

### 2. CardGallery.tsx — Priority 2

**Current Implementation:**
```tsx
// Header with filter buttons and access mode toggle
<header className={styles.header}>
  <button onClick={() => setFilter('all')} className={styles.filterButton}>All</button>
  <button onClick={() => setFilter('accessible')} className={styles.filterButton}>My Access</button>
  {companies.map((company) => <button>...</button>)}
  <div className={styles.modeToggle}>
    <button>Lock</button>
    <button>Hide</button>
  </div>
</header>
<div className={styles.grid}>
  <AnimatePresence>{filteredCampaigns.map(...)}</AnimatePresence>
</div>
```

**Mantine Replacement:**
```tsx
import { Container, Group, Stack, Title, Text, SegmentedControl, Tabs, SimpleGrid, Badge } from '@mantine/core';

<Box className={styles.gallery}> {/* Keep gradient background via SCSS */}
  <Box component="header" className={styles.header}> {/* Keep sticky header via SCSS */}
    <Container size="xl">
      <Group justify="space-between" wrap="wrap" gap="md">
        <Stack gap={0}>
          <Title order={1} size="h3" c="white">Campaign Gallery</Title>
          <Text c="dimmed" size="sm">Browse and access your campaign media</Text>
        </Stack>
        
        <Tabs value={filter} onChange={(v) => setFilter(v ?? 'all')}>
          <Tabs.List>
            <Tabs.Tab value="all">All</Tabs.Tab>
            <Tabs.Tab value="accessible">My Access</Tabs.Tab>
            {companies.map((company) => (
              <Tabs.Tab key={company} value={company}>{company}</Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs>

        {isAdmin && (
          <Group gap="sm">
            <Text size="xs" fw={600} tt="uppercase">Access mode</Text>
            <SegmentedControl
              value={accessMode}
              onChange={(v) => onAccessModeChange?.(v as 'lock' | 'hide')}
              data={[
                { label: 'Lock', value: 'lock' },
                { label: 'Hide', value: 'hide' },
              ]}
            />
          </Group>
        )}
      </Group>
    </Container>
  </Box>

  <Container size="xl" py="xl">
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
      <AnimatePresence mode="popLayout">
        {filteredCampaigns.map((campaign) => (
          <CampaignCard key={campaign.id} ... />
        ))}
      </AnimatePresence>
    </SimpleGrid>
  </Container>
</Box>
```

**Migration Steps:**
1. Replace filter buttons with `<Tabs>` component
2. Replace mode toggle with `<SegmentedControl>`
3. Replace custom grid with `<SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>`
4. Keep `<AnimatePresence>` wrapper for framer-motion animations
5. Use `<Container>`, `<Group>`, `<Stack>` for layout
6. Preserve gradient background via custom className (keep partial SCSS)
7. Preserve sticky header behavior via custom className

**Breaking Changes:**
- Filter button colors must be configured via Tabs `color` prop or custom styles
- Grid responsive breakpoints change slightly (test visual parity)

**Risk Level:** Medium
**Effort:** 4-6 hours

---

### 3. CampaignCard.tsx — Priority 3

**Current Implementation:**
```tsx
<motion.div className={styles.card} style={{ borderLeft: `4px solid ${brandColor}` }}>
  <div className={styles.thumbnail}>
    <img src={thumbnail} />
    <div className={styles.lockOverlay}>...</div>
    <div className={styles.accessBadge}>...</div>
    <div className={styles.companyBadge}>...</div>
  </div>
  <div className={styles.content}>
    <h3>{title}</h3>
    <p>{description}</p>
    <div className={styles.tags}>{tags.map(...)}</div>
    <div className={styles.mediaStats}>...</div>
  </div>
</motion.div>
```

**Mantine Replacement:**
```tsx
import { Card, Image, Badge, Group, Text, Box, Overlay, Stack } from '@mantine/core';
import { motion } from 'framer-motion';

const MotionCard = motion(Card);

<MotionCard
  shadow="sm"
  padding={0}
  radius="md"
  withBorder
  style={{ borderLeft: `4px solid ${campaign.company.brandColor}` }}
  onClick={hasAccess ? onClick : undefined}
  layout
  initial={{ opacity: 0, scale: 0.9 }}
  animate={{ opacity: 1, scale: 1 }}
  exit={{ opacity: 0, scale: 0.9 }}
  whileHover={{ scale: hasAccess ? 1.03 : 1.01, y: hasAccess ? -5 : 0 }}
  whileTap={{ scale: hasAccess ? 0.98 : 1 }}
>
  <Card.Section pos="relative">
    <Image src={campaign.thumbnail} alt={campaign.title} h={200} />
    
    {/* Lock overlay */}
    {!hasAccess && (
      <Overlay color="#000" backgroundOpacity={0.6} center>
        <Lock size={32} color="white" />
      </Overlay>
    )}
    
    {/* Company badge */}
    <Badge
      pos="absolute"
      bottom={8}
      left={8}
      style={{ backgroundColor: campaign.company.brandColor }}
    >
      {campaign.company.logo} {campaign.company.name}
    </Badge>
    
    {/* Access indicator */}
    {hasAccess && (
      <Badge pos="absolute" top={8} right={8} color="green" leftSection={<Eye size={14} />}>
        Access
      </Badge>
    )}
  </Card.Section>
  
  <Stack p="md" gap="sm">
    <Text fw={600} lineClamp={1}>{campaign.title}</Text>
    <Text size="sm" c="dimmed" lineClamp={2}>{campaign.description}</Text>
    
    <Group gap="xs">
      {campaign.tags.map((tag) => (
        <Badge key={tag} variant="light" size="sm">#{tag}</Badge>
      ))}
    </Group>
    
    <Group gap="md" mt="auto">
      <Text size="xs" c="dimmed">🎬 {campaign.videos.length} videos</Text>
      <Text size="xs" c="dimmed">🖼️ {campaign.images.length} images</Text>
    </Group>
  </Stack>
</MotionCard>
```

**Migration Steps:**
1. Create `MotionCard = motion(Card)` wrapper for framer-motion compatibility
2. Replace thumbnail div with `<Card.Section>` + `<Image>`
3. Replace lock overlay with `<Overlay>` component
4. Replace custom badges with `<Badge>` components
5. Replace content div with `<Stack>` layout
6. Replace tags with `<Badge variant="light">`
7. Preserve `motion` animation props on the Card wrapper

**Breaking Changes:**
- Hover border effect needs recreation via `styles` prop or custom CSS
- Image grayscale filter for locked cards needs custom `styles` on Image

**Adaptations Required:**
```tsx
// Add to Image for locked state:
<Image 
  src={...}
  style={{ filter: hasAccess ? 'none' : 'grayscale(100%)' }}
/>
```

**Risk Level:** Medium
**Effort:** 4-6 hours

---

### 4. CampaignViewer.tsx — Priority 4

**Current Implementation:**
```tsx
<motion.div className={styles.overlay}>
  <motion.div className={styles.backdrop} onClick={onClose} />
  <motion.div className={styles.modal}>
    <div className={styles.cover}>...</div>
    <div className={styles.content}>...</div>
  </motion.div>
</motion.div>
```

**Mantine Replacement:**
```tsx
import { Modal, Image, Badge, Group, Stack, Title, Text, SimpleGrid, Paper, Button, Box } from '@mantine/core';

<Modal
  opened={true}
  onClose={onClose}
  fullScreen
  padding={0}
  withCloseButton={false}
  transitionProps={{ transition: 'slide-up', duration: 300 }}
>
  {/* Cover Image Header */}
  <Box pos="relative" h={300}>
    <Image src={campaign.coverImage} alt={campaign.title} h={300} />
    <Overlay gradient="linear-gradient(transparent, rgba(0,0,0,0.8))" />
    
    <Button 
      pos="absolute" 
      top={16} 
      left={16} 
      leftSection={<ArrowLeft size={16} />}
      onClick={onClose}
      variant="default"
    >
      Back to Gallery
    </Button>
    
    <Badge
      pos="absolute"
      top={16}
      right={16}
      style={{ backgroundColor: campaign.company.brandColor }}
    >
      {campaign.company.logo} {campaign.company.name}
    </Badge>
    
    <Stack pos="absolute" bottom={16} left={16} right={16} gap="xs">
      <Title order={1} c="white">{campaign.title}</Title>
      <Group gap="md">
        <Text size="sm" c="gray.4"><Calendar size={14} /> {formattedDate}</Text>
        <Text size="sm" c="gray.4"><Tag size={14} /> {campaign.tags.join(', ')}</Text>
      </Group>
    </Stack>
  </Box>
  
  <Stack p="xl" gap="xl">
    <Box>
      <Title order={2} size="h4" mb="sm">About this Campaign</Title>
      <Text c="dimmed">{campaign.description}</Text>
    </Box>
    
    {!hasAccess && (
      <Paper p="md" withBorder bg="yellow.1">
        <Text>This campaign is private. Sign in or request access to view media.</Text>
      </Paper>
    )}
    
    {hasAccess && campaign.videos.length > 0 && <VideoCarousel videos={campaign.videos} />}
    {hasAccess && campaign.images.length > 0 && <ImageCarousel images={campaign.images} />}
    
    {/* Stats Grid */}
    <SimpleGrid cols={4}>
      <Paper p="md" radius="md" withBorder ta="center">
        <Text size="xl" fw={700}>{campaign.videos.length}</Text>
        <Text size="sm" c="dimmed">Videos</Text>
      </Paper>
      {/* ... more stat cards */}
    </SimpleGrid>
    
    {/* Admin Actions */}
    <Paper p="md" withBorder>
      <Title order={3} size="h5" mb="sm">Admin Actions</Title>
      <Group>
        <Button disabled={!isAdmin} onClick={() => onEditCampaign?.(campaign)}>Edit Campaign</Button>
        <Button disabled={!isAdmin} onClick={() => onAddExternalMedia?.(campaign)}>Manage Media</Button>
        <Button disabled={!isAdmin} color="red" onClick={() => onArchiveCampaign?.(campaign)}>Archive</Button>
      </Group>
    </Paper>
  </Stack>
</Modal>
```

**Migration Steps:**
1. Replace `motion.div` overlay with `<Modal fullScreen>`
2. Replace backdrop with Modal's built-in backdrop
3. Replace cover image section with `<Box pos="relative">` + `<Image>` + `<Overlay>`
4. Replace back button with `<Button leftSection={...}>`
5. Replace content layout with `<Stack>` and `<Group>`
6. Replace stats grid with `<SimpleGrid>` + `<Paper>` cards
7. Replace admin buttons with `<Button>` components
8. **Option:** Keep framer-motion for custom animations by using Modal's `opened` state

**Breaking Changes:**
- Modal transitions differ from custom framer-motion animations
- Cover image overlay gradient may need adjustment

**Risk Level:** High (complex layout, animations)
**Effort:** 6-8 hours

---

### 5. VideoCarousel.tsx — Priority 5

**Current Implementation:**
- Custom carousel with thumbnail strip
- Play button overlay
- Navigation arrows
- framer-motion for poster transitions

**Mantine Replacement Options:**

**Option A: Use @mantine/carousel**
```tsx
import { Carousel } from '@mantine/carousel';

<Box>
  <Title order={3} size="h5" mb="sm"><Play size={16} /> Videos ({videos.length})</Title>
  
  <Carousel
    slideSize="100%"
    slideGap="md"
    withIndicators
    loop
    controlsOffset="xs"
  >
    {videos.map((video, index) => (
      <Carousel.Slide key={video.id}>
        <AspectRatio ratio={16 / 9}>
          {isPlaying && currentIndex === index ? (
            <iframe src={`${video.embedUrl}?autoplay=1`} allowFullScreen />
          ) : (
            <Box pos="relative">
              <Image src={video.thumbnail} alt={video.caption} />
              <Overlay center>
                <ActionIcon size="xl" radius="xl" onClick={() => playVideo(index)}>
                  <Play size={24} />
                </ActionIcon>
              </Overlay>
            </Box>
          )}
        </AspectRatio>
      </Carousel.Slide>
    ))}
  </Carousel>
  
  {/* Thumbnail strip */}
  <Group mt="md" gap="xs">
    {videos.map((video, index) => (
      <Image
        key={video.id}
        src={video.thumbnail}
        w={80}
        h={45}
        radius="sm"
        onClick={() => setCurrentIndex(index)}
        style={{ 
          opacity: index === currentIndex ? 1 : 0.6,
          cursor: 'pointer',
          border: index === currentIndex ? '2px solid var(--mantine-color-blue-5)' : 'none'
        }}
      />
    ))}
  </Group>
</Box>
```

**Option B: Keep Custom Implementation (Recommended)**
- Keep existing VideoCarousel logic
- Replace only styling elements with Mantine components
- Preserve framer-motion animations

**Migration Steps (Option B - Recommended):**
1. Replace section heading with `<Title>` + icon
2. Replace nav buttons with `<ActionIcon>` components
3. Replace thumbnail buttons with styled `<Image>` components
4. Replace caption with `<Text>` component
5. Keep custom carousel logic and framer-motion

**Breaking Changes:**
- @mantine/carousel adds ~15KB to bundle if used
- Custom thumbnail strip behavior may differ from Carousel's indicators

**Risk Level:** High
**Effort:** 4-6 hours

---

### 6. ImageCarousel.tsx — Priority 6

**Current Implementation:**
- Custom carousel with thumbnail strip
- Lightbox modal for full-screen viewing
- Navigation arrows with framer-motion transitions

**Mantine Replacement:**
```tsx
import { Image, Box, Group, ActionIcon, Text, Modal, Stack } from '@mantine/core';
import { Carousel } from '@mantine/carousel';

<Box>
  <Title order={3} size="h5" mb="sm"><ImageIcon size={16} /> Images ({images.length})</Title>
  
  <Box pos="relative">
    <AspectRatio ratio={16 / 9}>
      <AnimatePresence mode="wait">
        <motion.div key={currentIndex} ...>
          <Image 
            src={currentImage.url} 
            alt={currentImage.caption}
            onClick={() => setIsLightboxOpen(true)}
            style={{ cursor: 'zoom-in' }}
          />
        </motion.div>
      </AnimatePresence>
    </AspectRatio>
    
    <ActionIcon pos="absolute" top="50%" left={8} onClick={prevImage}>
      <ChevronLeft />
    </ActionIcon>
    <ActionIcon pos="absolute" top="50%" right={8} onClick={nextImage}>
      <ChevronRight />
    </ActionIcon>
    
    <Badge pos="absolute" bottom={8} right={8}>
      {currentIndex + 1} / {images.length}
    </Badge>
  </Box>
  
  <Text size="sm" c="dimmed" mt="sm">{currentImage.caption}</Text>
  
  {/* Thumbnail strip */}
  <Group mt="md" gap="xs">
    {images.map((image, index) => (
      <Image
        key={image.id}
        src={image.url}
        w={60}
        h={60}
        radius="sm"
        onClick={() => setCurrentIndex(index)}
        style={{ 
          opacity: index === currentIndex ? 1 : 0.6,
          border: index === currentIndex ? '2px solid var(--mantine-color-blue-5)' : 'none'
        }}
      />
    ))}
  </Group>
  
  {/* Lightbox */}
  <Modal opened={isLightboxOpen} onClose={() => setIsLightboxOpen(false)} fullScreen>
    <Box h="100vh" pos="relative">
      <Image src={currentImage.url} alt={currentImage.caption} fit="contain" h="100%" />
      {/* Navigation and caption */}
    </Box>
  </Modal>
</Box>
```

**Migration Steps:**
1. Replace heading with `<Title>`
2. Replace nav buttons with `<ActionIcon>`
3. Replace counter badge with `<Badge>`
4. Replace lightbox overlay with `<Modal fullScreen>`
5. Replace thumbnail strip with styled `<Image>` + `<Group>`
6. Keep framer-motion `<AnimatePresence>` for slide transitions

**Breaking Changes:**
- Lightbox close button styling changes
- Modal transition differs from custom animation

**Risk Level:** High
**Effort:** 4-6 hours

---

### 7. App.tsx Layout — Priority 7

**Current Implementation:**
```tsx
<div className="wp-super-gallery">
  <div className="wp-super-gallery__authbar">...</div>
  <div className="wp-super-gallery__banner wp-super-gallery__banner--error">...</div>
  <div className="wp-super-gallery__container">...</div>
</div>
```

**Mantine Replacement:**
```tsx
import { Container, Group, Button, Alert, Text, Box } from '@mantine/core';

<Box className="wp-super-gallery"> {/* Keep for Shadow DOM scoping */}
  {isAuthenticated && (
    <Container size="xl" py="sm">
      <Group justify="space-between" p="sm" bg="dark.7" style={{ borderRadius: 'var(--mantine-radius-md)' }}>
        <Text>Signed in as {user.email}</Text>
        <Group>
          {isAdmin && <Button onClick={() => setIsAdminPanelOpen(true)}>Admin Panel</Button>}
          <Button variant="subtle" onClick={() => logout()}>Sign out</Button>
        </Group>
      </Group>
    </Container>
  )}
  
  {actionMessage && (
    <Container size="xl" py="sm">
      <Alert color={actionMessage.type === 'error' ? 'red' : 'green'}>
        {actionMessage.text}
      </Alert>
    </Container>
  )}
  
  {error && (
    <Container size="xl" py="sm">
      <Alert color="red">{error}</Alert>
    </Container>
  )}
  
  {/* Rest of app */}
</Box>
```

**Migration Steps:**
1. Replace auth bar with `<Group>` + `<Button>` components
2. Replace banner messages with `<Alert>` components
3. Replace container class with `<Container size="xl">`
4. Keep root `.wp-super-gallery` class for Shadow DOM scoping

**Breaking Changes:** None significant
**Risk Level:** Low
**Effort:** 2-3 hours

---

### 8. Theme Integration — Priority 8

**Current Tokens (_tokens.scss):**
```scss
--color-bg: #0f172a;
--color-surface: #1e293b;
--color-text: #ffffff;
--color-muted: #94a3b8;
--color-accent: #3b82f6;
```

**Mantine Theme Mapping:**
```tsx
// src/theme.ts
import { createTheme, MantineColorsTuple } from '@mantine/core';

const darkSurface: MantineColorsTuple = [
  '#f8fafc', '#f1f5f9', '#e2e8f0', '#cbd5e1', '#94a3b8',
  '#64748b', '#475569', '#334155', '#1e293b', '#0f172a'
];

export const theme = createTheme({
  primaryColor: 'blue',
  colors: {
    dark: darkSurface,
  },
  defaultRadius: 'md',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  headings: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  other: {
    filterAll: '#2563eb',
    filterAccessible: '#16a34a',
    filterCompany: '#7c3aed',
  },
});
```

**Integration Steps:**
1. Create `src/theme.ts` with custom theme
2. Update `MantineProvider` in main.tsx/App.tsx to use theme
3. Replace CSS variable references with Mantine color tokens
4. Keep global.scss for Shadow DOM reset styles only

---

## Migration Risks & Mitigations

### High Risk Items

| Risk | Impact | Mitigation |
|------|--------|------------|
| framer-motion + Mantine conflicts | Animations break | Wrap Mantine components with `motion()`, test each transition |
| Shadow DOM style injection | Styles not applied | Ensure all Mantine packages are included in `shadowStyles.ts` |
| Bundle size increase | Performance regression | Monitor bundle before/after, consider @mantine/carousel carefully |
| Visual regression | UX degradation | Screenshot testing, side-by-side comparison |

### Medium Risk Items

| Risk | Impact | Mitigation |
|------|--------|------------|
| Tabs/SegmentedControl color customization | Wrong brand colors | Use `color` prop or custom `styles` object |
| Card hover animations | Loss of polish | Test motion props on MotionCard wrapper |
| Modal transition timing | Different feel | Configure `transitionProps` to match current timing |

### Low Risk Items

| Risk | Impact | Mitigation |
|------|--------|------------|
| Form validation differences | Minor UX change | Mantine forms have better validation UX |
| Button/Input styling | Minor visual change | Consistent Mantine styling is an improvement |

---

## Dependencies Required

```json
{
  "@mantine/core": "^7.17.8",       // Already installed
  "@mantine/hooks": "^7.17.8",      // Already installed
  "@mantine/carousel": "^7.17.8",   // NEW - Optional, adds ~15KB
  "embla-carousel-react": "^8.0.0"  // Peer dep for @mantine/carousel
}
```

---

## Testing Checklist

### Per-Component Testing

- [ ] **LoginForm**: Login flow works, error states display correctly
- [ ] **CardGallery**: Filters work, grid responsive, animations smooth
- [ ] **CampaignCard**: Hover animations, locked state, badges visible
- [ ] **CampaignViewer**: Modal opens/closes, media loads, admin actions work
- [ ] **VideoCarousel**: Video plays, navigation works, thumbnails selectable
- [ ] **ImageCarousel**: Navigation works, lightbox opens, transitions smooth
- [ ] **App layout**: Auth bar displays, alerts work, container width correct

### Cross-Browser Testing

- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Safari
- [ ] Mobile Chrome

### Shadow DOM Testing

- [ ] Styles apply correctly within Shadow DOM
- [ ] No style leakage to parent document
- [ ] Mantine modals render correctly

---

## Recommended Migration Order

1. **Week 1-2: Foundation**
   - [ ] Create Mantine theme (theme.ts)
   - [ ] Migrate LoginForm (lowest risk, validates theme)
   - [ ] Update shadowStyles.ts for any new packages

2. **Week 3-4: Gallery**
   - [ ] Migrate CardGallery header/filters
   - [ ] Migrate CampaignCard
   - [ ] Test animations and responsive behavior

3. **Week 5-6: Campaign Viewer**
   - [ ] Migrate CampaignViewer modal
   - [ ] Migrate VideoCarousel
   - [ ] Migrate ImageCarousel

4. **Week 7-8: Polish & Cleanup**
   - [ ] Migrate App.tsx layout elements
   - [ ] Remove deprecated SCSS modules
   - [ ] Full QA testing
   - [ ] Documentation updates

---

Document updated: January 28, 2026.
Document created: January 23, 2026.
