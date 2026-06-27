/**
 * P12-C / P23-C: Gallery Adapter Registry
 *
 * Central source of truth for adapter runtime resolution and editor metadata.
 * The registry owns labels, aliases, breakpoint restrictions, setting-group
 * membership, and the component used to render each adapter.
 *
 * P55-A: Setting-group data and adapter definitions extracted to
 * src/data/adapterSettingGroups.ts; this file retains registration/resolution
 * logic only.
 */
import { type ComponentType } from 'react';
import type { Breakpoint } from '@/hooks/useBreakpoint';
import type {
  AdapterOptionContext,
  AdapterRegistration,
  AdapterSettingFieldDefinition,
  AdapterSettingGroupDefinition,
  AdapterSettingGroup,
  GalleryAdapterId,
  GalleryAdapterProps,
} from './GalleryAdapter';
import { BUILTIN_ADAPTERS, SETTING_GROUP_DEFINITIONS } from '@/data/adapterSettingGroups';

export interface AdapterSelectOption {
  value: GalleryAdapterId;
  label: string;
  disabled?: boolean;
}

// Internal map keyed by adapter id
const registry = new Map<string, AdapterRegistration>();

for (const adapter of BUILTIN_ADAPTERS) {
  registerAdapter(adapter);
}

/**
 * @internal Closed built-ins-only seam. Because `GalleryAdapterId` is a closed
 * union, third-party ids cannot satisfy it without widening the type. Widening
 * would require opening `GalleryAdapterId` and adding PHP sanitizer entries.
 */
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

export function getSettingGroupDefinition(group: AdapterSettingGroup): AdapterSettingGroupDefinition | undefined {
  return SETTING_GROUP_DEFINITIONS[group];
}

export function getSettingGroupFieldDefinitions(group: AdapterSettingGroup): AdapterSettingFieldDefinition[] {
  return getSettingGroupDefinition(group)?.fields ?? [];
}

export function getActiveSettingGroupDefinitions(ids: Array<string | null | undefined>): AdapterSettingGroupDefinition[] {
  return Object.values(SETTING_GROUP_DEFINITIONS).filter((definition) => anyAdapterUsesSettingGroup(ids, definition.group));
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
    const label = adapter.optionLabels?.[context] ?? adapter.label;

    return {
      value: adapter.id,
      label,
      disabled,
    };
  });
}

/**
 * P35-A: Return select options for adapters that can render a campaign listing.
 * Filtered to adapters tagged with `'listing-compatible'` capability, optionally
 * further filtered by breakpoint support.
 */
export function getListingAdapterSelectOptions(breakpoint?: Breakpoint): AdapterSelectOption[] {
  return getRegisteredAdapters()
    .filter((adapter) => adapter.capabilities.includes('listing-compatible'))
    .filter((adapter) => breakpoint === undefined || isAdapterSupportedAtBreakpoint(adapter.id, breakpoint))
    .map((adapter) => ({
      value: adapter.id,
      label: adapter.optionLabels?.['campaign-listing'] ?? adapter.label,
    }));
}

/**
 * P35-A: Returns true when the adapter with the given id owns its own pagination
 * state in listing mode (e.g. the classic carousel).  The host (CardGallery) hides
 * its display-mode controls when this returns true.
 */
export function adapterOwnsPagination(id: string): boolean {
  return getAdapterRegistration(normalizeAdapterId(id))?.paginationOwnership === 'adapter';
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
