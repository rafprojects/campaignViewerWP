import { adapterUsesSettingGroup } from '@/components/Galleries/Adapters/adapterRegistry';
import type {
  AdapterSettingFieldDefinition,
  AdapterSettingGroupDefinition,
  AdapterSettingGroupScopeMode,
} from '@/components/Galleries/Adapters/GalleryAdapter';
import {
  DEFAULT_GALLERY_BEHAVIOR_SETTINGS,
  type GalleryCommonSettings,
  type GalleryConfig,
  type GalleryConfigBreakpoint,
  type GalleryConfigMode,
  type GalleryConfigScope,
} from '@/types';
import { cloneGalleryConfig, getLegacyViewportBackgroundFieldMap } from '@/utils/galleryConfig';
import i18n from '@/i18n';

export const GALLERY_BREAKPOINTS: GalleryConfigBreakpoint[] = ['desktop', 'tablet', 'mobile'];
export type EditableGalleryScope = Extract<GalleryConfigScope, 'unified' | 'image' | 'video'>;

export type SharedCommonSettingKey = keyof Pick<
  GalleryCommonSettings,
  | 'sectionMaxWidth'
  | 'sectionMaxHeight'
  | 'sectionMinWidth'
  | 'sectionMinHeight'
  | 'sectionHeightMode'
  | 'perTypeSectionEqualHeight'
  | 'sectionPadding'
  | 'adapterContentPadding'
  | 'adapterSizingMode'
  | 'adapterMaxWidthPct'
  | 'adapterMaxHeightPct'
  | 'adapterItemGap'
  | 'adapterJustifyContent'
  | 'gallerySizingMode'
  | 'galleryManualHeight'
  | 'galleryImageLabel'
  | 'galleryVideoLabel'
  | 'galleryLabelJustification'
  | 'showGalleryLabelIcon'
  | 'showCampaignGalleryLabels'
>;

export type ScopeSpecificCommonSettingKey = keyof Pick<
  GalleryCommonSettings,
  'viewportBgType' | 'viewportBgColor' | 'viewportBgGradient' | 'viewportBgImageUrl'
>;

export function getScopeAdapterId(
  config: Partial<GalleryConfig> | undefined,
  breakpoint: GalleryConfigBreakpoint,
  scope: EditableGalleryScope,
): string {
  return config?.breakpoints?.[breakpoint]?.[scope]?.adapterId ?? '';
}

export function hasConfiguredAdapterId(id: string | null | undefined): id is string {
  return typeof id === 'string' && id.trim().length > 0;
}

function configuredAdapterUsesSettingGroup(id: string | null | undefined, group: AdapterSettingGroupDefinition['group']): boolean {
  return hasConfiguredAdapterId(id) && adapterUsesSettingGroup(id, group);
}

export function getEditableScopes(mode: GalleryConfigMode): Array<EditableGalleryScope> {
  return mode === 'unified' ? ['unified'] : ['image', 'video'];
}

export function formatScopeLabel(scope: EditableGalleryScope): string {
  switch (scope) {
    case 'unified':
      return 'Unified Gallery';
    case 'image':
      return 'Image Gallery';
    case 'video':
      return 'Video Gallery';
  }
}

export function getScopeViewportBackgroundFallbacks(scope: EditableGalleryScope) {
  const fieldMap = getLegacyViewportBackgroundFieldMap(scope);

  return {
    viewportBgType: DEFAULT_GALLERY_BEHAVIOR_SETTINGS[fieldMap.viewportBgType],
    viewportBgColor: DEFAULT_GALLERY_BEHAVIOR_SETTINGS[fieldMap.viewportBgColor],
    viewportBgGradient: DEFAULT_GALLERY_BEHAVIOR_SETTINGS[fieldMap.viewportBgGradient],
    viewportBgImageUrl: DEFAULT_GALLERY_BEHAVIOR_SETTINGS[fieldMap.viewportBgImageUrl],
  };
}

export function getRepresentativeCommonValue(
  config: Partial<GalleryConfig> | undefined,
  breakpoint: GalleryConfigBreakpoint,
  key: SharedCommonSettingKey,
): number | string | boolean | undefined {
  const scopes = getEditableScopes(config?.mode ?? 'per-type');

  for (const scope of scopes) {
    const value = config?.breakpoints?.[breakpoint]?.[scope]?.common?.[key];
    if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
      return value;
    }
  }

  return undefined;
}

export function getRepresentativeNumberCommonValue(
  config: Partial<GalleryConfig> | undefined,
  breakpoint: GalleryConfigBreakpoint,
  key: Extract<SharedCommonSettingKey, 'sectionMaxWidth' | 'sectionMaxHeight' | 'sectionMinWidth' | 'sectionMinHeight' | 'sectionPadding' | 'adapterContentPadding' | 'adapterMaxWidthPct' | 'adapterMaxHeightPct' | 'adapterItemGap'>,
): number | undefined {
  const value = getRepresentativeCommonValue(config, breakpoint, key);
  return typeof value === 'number' ? value : undefined;
}

export function getRepresentativeStringCommonValue(
  config: Partial<GalleryConfig> | undefined,
  breakpoint: GalleryConfigBreakpoint,
  key: Extract<SharedCommonSettingKey, 'sectionHeightMode' | 'adapterSizingMode' | 'adapterJustifyContent' | 'gallerySizingMode' | 'galleryManualHeight' | 'galleryImageLabel' | 'galleryVideoLabel' | 'galleryLabelJustification'>,
): string | undefined {
  const value = getRepresentativeCommonValue(config, breakpoint, key);
  return typeof value === 'string' ? value : undefined;
}

export function getRepresentativeBooleanCommonValue(
  config: Partial<GalleryConfig> | undefined,
  breakpoint: GalleryConfigBreakpoint,
  key: Extract<SharedCommonSettingKey, 'perTypeSectionEqualHeight' | 'showGalleryLabelIcon' | 'showCampaignGalleryLabels'>,
): boolean | undefined {
  const value = getRepresentativeCommonValue(config, breakpoint, key);
  return typeof value === 'boolean' ? value : undefined;
}

export function getRepresentativeAdapterSettingValue(
  config: Partial<GalleryConfig> | undefined,
  breakpoint: GalleryConfigBreakpoint,
  group: AdapterSettingGroupDefinition,
  field: AdapterSettingFieldDefinition,
): number | string | boolean | undefined {
  const scopes = getApplicableScopes(config?.mode ?? 'per-type', group.scopeMode ?? 'shared', field);

  for (const scope of scopes) {
    const scopeConfig = config?.breakpoints?.[breakpoint]?.[scope];
    if (!configuredAdapterUsesSettingGroup(scopeConfig?.adapterId, group.group)) {
      continue;
    }

    const value = scopeConfig?.adapterSettings?.[field.key];
    if (
      ((field.control === 'number' || field.control === 'dimension') && typeof value === 'number')
      || ((field.control === 'select' || field.control === 'text' || field.control === 'color') && typeof value === 'string')
      || (field.control === 'boolean' && typeof value === 'boolean')
    ) {
      return value;
    }
  }

  return undefined;
}

export function getScopeCommonValue(
  config: Partial<GalleryConfig> | undefined,
  breakpoint: GalleryConfigBreakpoint,
  scope: EditableGalleryScope,
  key: ScopeSpecificCommonSettingKey,
): string | undefined {
  const value = config?.breakpoints?.[breakpoint]?.[scope]?.common?.[key];
  return typeof value === 'string' ? value : undefined;
}

export function pruneConfig(config: GalleryConfig): GalleryConfig {
  const next = cloneGalleryConfig(config) ?? {};

  GALLERY_BREAKPOINTS.forEach((breakpoint) => {
    const breakpointConfig = next.breakpoints?.[breakpoint];
    if (!breakpointConfig) {
      return;
    }

    (['unified', 'image', 'video'] as const).forEach((scope) => {
      const scopeConfig = breakpointConfig[scope];
      if (!scopeConfig) {
        return;
      }

      if (!scopeConfig.adapterId && !scopeConfig.common && !scopeConfig.adapterSettings) {
        delete breakpointConfig[scope];
      }
    });

    if (!Object.keys(breakpointConfig).length) {
      delete next.breakpoints?.[breakpoint];
    }
  });

  return {
    mode: next.mode ?? 'per-type',
    breakpoints: next.breakpoints ?? {},
  };
}

export function setConfigMode(config: GalleryConfig, mode: GalleryConfigMode): GalleryConfig {
  return pruneConfig({
    ...config,
    mode,
  });
}

export function setScopeAdapterId(
  config: GalleryConfig,
  breakpoint: GalleryConfigBreakpoint,
  scope: Extract<GalleryConfigScope, 'unified' | 'image' | 'video'>,
  adapterId: string,
): GalleryConfig {
  const next = cloneGalleryConfig(config) ?? { mode: config.mode ?? 'per-type', breakpoints: {} };
  next.breakpoints = next.breakpoints ?? {};
  const breakpointConfig = next.breakpoints[breakpoint] ?? {};

  if (adapterId) {
    breakpointConfig[scope] = {
      ...(breakpointConfig[scope] ?? {}),
      adapterId,
    };
  } else if (breakpointConfig[scope]) {
    delete breakpointConfig[scope]?.adapterId;
  }

  next.breakpoints[breakpoint] = breakpointConfig;
  return pruneConfig({
    mode: next.mode ?? 'per-type',
    breakpoints: next.breakpoints,
  });
}

export function setCommonSettingForEditableScopes(
  config: GalleryConfig,
  breakpoint: GalleryConfigBreakpoint,
  key: SharedCommonSettingKey,
  value: number | string | boolean,
): GalleryConfig {
  const next = cloneGalleryConfig(config) ?? { mode: config.mode ?? 'per-type', breakpoints: {} };
  next.breakpoints = next.breakpoints ?? {};

  const breakpointConfig = next.breakpoints?.[breakpoint] ?? {};

  getEditableScopes(next.mode ?? 'per-type').forEach((scope) => {
    breakpointConfig[scope] = {
      ...(breakpointConfig[scope] ?? {}),
      common: {
        ...(breakpointConfig[scope]?.common ?? {}),
        [key]: value,
      },
    };
  });

  next.breakpoints[breakpoint] = breakpointConfig;

  return pruneConfig({
    mode: next.mode ?? 'per-type',
    breakpoints: next.breakpoints,
  });
}

export function setCommonSettingForScope(
  config: GalleryConfig,
  breakpoint: GalleryConfigBreakpoint,
  scope: EditableGalleryScope,
  key: ScopeSpecificCommonSettingKey,
  value: string,
): GalleryConfig {
  const next = cloneGalleryConfig(config) ?? { mode: config.mode ?? 'per-type', breakpoints: {} };
  next.breakpoints = next.breakpoints ?? {};

  const breakpointConfig = next.breakpoints?.[breakpoint] ?? {};

  breakpointConfig[scope] = {
    ...(breakpointConfig[scope] ?? {}),
    common: {
      ...(breakpointConfig[scope]?.common ?? {}),
      [key]: value,
    },
  };

  next.breakpoints[breakpoint] = breakpointConfig;

  return pruneConfig({
    mode: next.mode ?? 'per-type',
    breakpoints: next.breakpoints,
  });
}

function getApplicableScopes(
  mode: GalleryConfigMode,
  scopeMode: AdapterSettingGroupScopeMode,
  field: AdapterSettingFieldDefinition,
): Array<EditableGalleryScope> {
  const editableScopes = getEditableScopes(mode);
  const appliesTo = field.appliesTo ?? 'always';

  if (appliesTo === 'always') {
    return editableScopes;
  }

  const allowedScopes = Array.isArray(appliesTo) ? appliesTo : [appliesTo];

  if (scopeMode === 'contextual') {
    return editableScopes.filter((scope) => allowedScopes.includes(scope));
  }

  return editableScopes.filter((scope) => allowedScopes.includes(scope));
}

function hasVisibleAdapterSettingField(
  config: GalleryConfig,
  breakpoint: GalleryConfigBreakpoint,
  group: AdapterSettingGroupDefinition,
  field: AdapterSettingFieldDefinition,
): boolean {
  return getApplicableScopes(config.mode ?? 'per-type', group.scopeMode ?? 'shared', field).some((scope) =>
    configuredAdapterUsesSettingGroup(config.breakpoints?.[breakpoint]?.[scope]?.adapterId, group.group),
  );
}

const CONDITIONAL_ADAPTER_FIELD_CONTROLLERS = {
  imageShadowCustom: {
    controllerKey: 'imageShadowPreset',
    isVisible: (value: number | string | boolean | undefined) => value === 'custom',
  },
  videoShadowCustom: {
    controllerKey: 'videoShadowPreset',
    isVisible: (value: number | string | boolean | undefined) => value === 'custom',
  },
  tileBorderColor: {
    controllerKey: 'tileBorderWidth',
    isVisible: (value: number | string | boolean | undefined) => typeof value === 'number' && value > 0,
  },
  tileGlowColor: {
    controllerKey: 'tileGlowEnabled',
    isVisible: (value: number | string | boolean | undefined) => value === true,
  },
  tileGlowSpread: {
    controllerKey: 'tileGlowEnabled',
    isVisible: (value: number | string | boolean | undefined) => value === true,
  },
} as const;

export function shouldRenderAdapterSettingField(
  config: GalleryConfig,
  breakpoint: GalleryConfigBreakpoint,
  group: AdapterSettingGroupDefinition,
  field: AdapterSettingFieldDefinition,
): boolean {
  if (!hasVisibleAdapterSettingField(config, breakpoint, group, field)) {
    return false;
  }

  const controller = CONDITIONAL_ADAPTER_FIELD_CONTROLLERS[field.key as keyof typeof CONDITIONAL_ADAPTER_FIELD_CONTROLLERS];
  if (!controller) {
    return true;
  }

  const controllerField = group.fields.find((candidate) => candidate.key === controller.controllerKey);
  if (!controllerField) {
    return true;
  }

  return controller.isVisible(getRepresentativeAdapterSettingValue(config, breakpoint, group, controllerField));
}

export function formatSettingGroupLabel(group: AdapterSettingGroupDefinition['group']): string {
  const english = (() => {
    switch (group) {
      case 'media-frame':
        return 'Media Frame';
      case 'photo-grid':
        return 'Photo Grid';
      case 'tile-appearance':
        return 'Tile Appearance';
      case 'compact-grid':
        return 'Compact Grid';
      case 'layout-builder':
        return 'Layout Builder';
      case 'shape':
        return 'Shape Layout';
      default:
        return group.charAt(0).toUpperCase() + group.slice(1);
    }
  })();
  return i18n.t(`set_sg_group_${group}`, english, { ns: 'wpsg' });
}

export function setAdapterSettingForMatchingScopes(
  config: GalleryConfig,
  breakpoint: GalleryConfigBreakpoint,
  group: AdapterSettingGroupDefinition,
  field: AdapterSettingFieldDefinition,
  value: number | string | boolean,
): GalleryConfig {
  const next = cloneGalleryConfig(config) ?? { mode: config.mode ?? 'per-type', breakpoints: {} };
  next.breakpoints = next.breakpoints ?? {};
  const breakpointConfig = next.breakpoints[breakpoint] ?? {};

  getApplicableScopes(next.mode ?? 'per-type', group.scopeMode ?? 'shared', field).forEach((scope) => {
    if (!configuredAdapterUsesSettingGroup(breakpointConfig[scope]?.adapterId, group.group)) {
      return;
    }

    breakpointConfig[scope] = {
      ...(breakpointConfig[scope] ?? {}),
      adapterSettings: {
        ...(breakpointConfig[scope]?.adapterSettings ?? {}),
        [field.key]: value,
      },
    };
  });

  next.breakpoints[breakpoint] = breakpointConfig;

  return pruneConfig({
    mode: next.mode ?? 'per-type',
    breakpoints: next.breakpoints,
  });
}

export function resetBreakpointToBaseline(
  draft: GalleryConfig,
  baseline: GalleryConfig,
  breakpoint: GalleryConfigBreakpoint,
): GalleryConfig {
  const next = cloneGalleryConfig(draft) ?? { mode: draft.mode ?? 'per-type', breakpoints: {} };
  next.breakpoints = next.breakpoints ?? {};

  const baselineBreakpoint = cloneGalleryConfig(baseline)?.breakpoints?.[breakpoint];
  if (baselineBreakpoint) {
    next.breakpoints[breakpoint] = baselineBreakpoint;
  } else {
    delete next.breakpoints[breakpoint];
  }

  return pruneConfig({
    mode: next.mode ?? 'per-type',
    breakpoints: next.breakpoints,
  });
}

export function resetScopeToBaseline(
  draft: GalleryConfig,
  baseline: GalleryConfig,
  scope: EditableGalleryScope,
): GalleryConfig {
  const next = cloneGalleryConfig(draft) ?? { mode: draft.mode ?? 'per-type', breakpoints: {} };
  next.breakpoints = next.breakpoints ?? {};
  const baselineClone = cloneGalleryConfig(baseline);

  GALLERY_BREAKPOINTS.forEach((breakpoint) => {
    const breakpointConfig = next.breakpoints?.[breakpoint] ?? {};
    const baselineScopeConfig = baselineClone?.breakpoints?.[breakpoint]?.[scope];

    if (baselineScopeConfig) {
      breakpointConfig[scope] = baselineScopeConfig;
      next.breakpoints![breakpoint] = breakpointConfig;
      return;
    }

    if (!breakpointConfig[scope]) {
      return;
    }

    delete breakpointConfig[scope];

    if (Object.keys(breakpointConfig).length) {
      next.breakpoints![breakpoint] = breakpointConfig;
    } else {
      delete next.breakpoints![breakpoint];
    }
  });

  return pruneConfig({
    mode: next.mode ?? 'per-type',
    breakpoints: next.breakpoints,
  });
}
