/**
 * P12-C / P23-C: Gallery Adapter Registry
 *
 * Central source of truth for adapter runtime resolution and editor metadata.
 * The registry owns labels, aliases, breakpoint restrictions, setting-group
 * membership, and the component used to render each adapter.
 */
import { createElement, lazy, type ComponentType } from 'react';
import type { Breakpoint } from '@/hooks/useBreakpoint';
import type {
  AdapterOptionContext,
  AdapterRegistration,
  AdapterSettingGroup,
  GalleryAdapterId,
  GalleryAdapterProps,
} from './GalleryAdapter';
import { MediaCarouselAdapter } from './MediaCarouselAdapter';

export interface AdapterSelectOption {
  value: GalleryAdapterId;
  label: string;
  disabled?: boolean;
}

const CompactGridGallery = lazy(() =>
  import('@/components/Galleries/Adapters/compact-grid/CompactGridGallery').then((m) => ({ default: m.CompactGridGallery })),
);
const JustifiedGallery = lazy(() =>
  import('@/components/Galleries/Adapters/justified/JustifiedGallery').then((m) => ({ default: m.JustifiedGallery })),
);
const MasonryGallery = lazy(() =>
  import('@/components/Galleries/Adapters/masonry/MasonryGallery').then((m) => ({ default: m.MasonryGallery })),
);
const HexagonalGallery = lazy(() =>
  import('@/components/Galleries/Adapters/hexagonal/HexagonalGallery').then((m) => ({ default: m.HexagonalGallery })),
);
const CircularGallery = lazy(() =>
  import('@/components/Galleries/Adapters/circular/CircularGallery').then((m) => ({ default: m.CircularGallery })),
);
const DiamondGallery = lazy(() =>
  import('@/components/Galleries/Adapters/diamond/DiamondGallery').then((m) => ({ default: m.DiamondGallery })),
);
function LayoutBuilderRegistryFallback(props: GalleryAdapterProps) {
  return createElement(MediaCarouselAdapter, props);
}

// Internal map keyed by adapter id
const registry = new Map<string, AdapterRegistration>();

const BUILTIN_ADAPTERS: AdapterRegistration[] = [
  {
    id: 'classic',
    label: 'Classic',
    aliases: ['carousel'],
    optionLabels: {
      'unified-gallery': 'Classic (Carousel)',
      'per-type-gallery': 'Classic (Carousel)',
      'per-breakpoint-gallery': 'Classic',
      'campaign-override': 'Classic Carousel',
    },
    capabilities: ['carousel-layout', 'lightbox', 'keyboard-nav', 'touch-swipe'],
    settingGroups: ['carousel'],
    component: MediaCarouselAdapter,
  },
  {
    id: 'compact-grid',
    label: 'Compact Grid',
    capabilities: ['grid-layout', 'lightbox'],
    settingGroups: ['compact-grid'],
    component: CompactGridGallery as ComponentType<GalleryAdapterProps>,
  },
  {
    id: 'justified',
    label: 'Justified',
    aliases: ['mosaic'],
    optionLabels: {
      'unified-gallery': 'Justified Rows (Flickr-style)',
      'per-type-gallery': 'Justified Rows (Flickr-style)',
      'campaign-override': 'Justified',
    },
    capabilities: ['grid-layout', 'lightbox'],
    settingGroups: ['justified'],
    component: JustifiedGallery as ComponentType<GalleryAdapterProps>,
  },
  {
    id: 'masonry',
    label: 'Masonry',
    capabilities: ['grid-layout', 'lightbox'],
    settingGroups: ['masonry'],
    component: MasonryGallery as ComponentType<GalleryAdapterProps>,
  },
  {
    id: 'hexagonal',
    label: 'Hexagonal',
    capabilities: ['grid-layout', 'lightbox'],
    settingGroups: ['shape'],
    component: HexagonalGallery as ComponentType<GalleryAdapterProps>,
  },
  {
    id: 'circular',
    label: 'Circular',
    capabilities: ['grid-layout', 'lightbox'],
    settingGroups: ['shape'],
    component: CircularGallery as ComponentType<GalleryAdapterProps>,
  },
  {
    id: 'diamond',
    label: 'Diamond',
    capabilities: ['grid-layout', 'lightbox'],
    settingGroups: ['shape'],
    component: DiamondGallery as ComponentType<GalleryAdapterProps>,
  },
  {
    id: 'layout-builder',
    label: 'Layout Builder',
    optionLabels: {
      'per-type-gallery': 'Layout Builder -> per-breakpoint',
    },
    capabilities: ['layout-builder'],
    settingGroups: ['layout-builder'],
    supportsMobile: false,
    component: LayoutBuilderRegistryFallback,
  },
];

for (const adapter of BUILTIN_ADAPTERS) {
  registerAdapter(adapter);
}

export function registerAdapter(reg: AdapterRegistration): void {
  registry.set(reg.id, reg);
  for (const alias of reg.aliases ?? []) {
    registry.set(alias, reg);
  }
}

/** Return all registered adapters. */
export function getRegisteredAdapters(): AdapterRegistration[] {
  return BUILTIN_ADAPTERS.map((adapter) => registry.get(adapter.id) ?? adapter);
}

export function getAdapterRegistration(id: string): AdapterRegistration | undefined {
  return registry.get(id);
}

export function normalizeAdapterId(id: string | null | undefined): GalleryAdapterId {
  if (!id) {
    return 'classic';
  }
  const normalized = registry.get(id)?.id;
  return (normalized ?? id) as GalleryAdapterId;
}

export function adapterUsesSettingGroup(id: string | null | undefined, group: AdapterSettingGroup): boolean {
  return !!getAdapterRegistration(normalizeAdapterId(id))?.settingGroups.includes(group);
}

export function anyAdapterUsesSettingGroup(ids: Array<string | null | undefined>, group: AdapterSettingGroup): boolean {
  return ids.some((id) => adapterUsesSettingGroup(id, group));
}

export function isAdapterSupportedAtBreakpoint(id: string | null | undefined, breakpoint: Breakpoint): boolean {
  const adapter = getAdapterRegistration(normalizeAdapterId(id));
  if (!adapter) {
    return true;
  }
  if (breakpoint === 'mobile' && adapter.supportsMobile === false) {
    return false;
  }
  return true;
}

export function getAdapterSelectOptions(options: {
  context?: AdapterOptionContext;
  breakpoint?: Breakpoint;
} = {}): AdapterSelectOption[] {
  const { context = 'per-type-gallery', breakpoint } = options;

  return getRegisteredAdapters().map((adapter) => {
    const disabled = breakpoint ? !isAdapterSupportedAtBreakpoint(adapter.id, breakpoint) : false;
    let label = adapter.optionLabels?.[context] ?? adapter.label;

    if (disabled && adapter.id === 'layout-builder') {
      label = 'Layout Builder (desktop/tablet only)';
    }

    return {
      value: adapter.id,
      label,
      disabled,
    };
  });
}

/**
 * Resolve an adapter component by id.
 * Falls back to 'classic' if the requested id is not registered.
 * Throws only if 'classic' itself is not registered (should never happen).
 */
export function resolveAdapter(id: string): ComponentType<GalleryAdapterProps> {
  const found = registry.get(id);
  if (found) return found.component;

  // Hard fallback
  const classic = registry.get('classic');
  if (classic) return classic.component;

  throw new Error(
    `[WPSG] No adapter registered for id="${id}" and no "classic" fallback found.`,
  );
}
