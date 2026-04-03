/**
 * P12-C: Gallery Adapter Contract
 *
 * Defines the TypeScript interface for pluggable gallery adapters.
 * Each adapter registers with an id and provides a React component
 * that accepts a mixed media array — both images and videos — so a
 * single adapter can display all campaign media in one layout.
 */
import type { ComponentType } from 'react';
import type { MediaItem, GalleryBehaviorSettings, ContainerDimensions } from '@/types';
import type { GalleryMediaScope } from '@/utils/galleryAdapterSelection';

export type GalleryAdapterId =
  | 'classic'
  | 'carousel'
  | 'compact-grid'
  | 'justified'
  | 'mosaic'
  | 'masonry'
  | 'hexagonal'
  | 'circular'
  | 'diamond'
  | 'layout-builder';

/** Declared capabilities a gallery adapter can support. */
export type AdapterCapability =
  | 'lightbox'
  | 'drag-scroll'
  | 'infinite-scroll'
  | 'grid-layout'
  | 'carousel-layout'
  | 'keyboard-nav'
  | 'touch-swipe'
  | 'layout-builder';

export type AdapterSettingGroup =
  | 'media-frame'
  | 'photo-grid'
  | 'tile-appearance'
  | 'carousel'
  | 'compact-grid'
  | 'justified'
  | 'masonry'
  | 'shape'
  | 'layout-builder';

export type AdapterSettingFieldScope = 'unified' | 'image' | 'video';

export type AdapterSettingFieldAppliesTo = 'always' | AdapterSettingFieldScope | readonly AdapterSettingFieldScope[];

export type AdapterSettingGroupLayout = 'group' | 'stack';

export type AdapterSettingGroupPlacement = 'inline' | 'section';

export type AdapterSettingGroupScopeMode = 'shared' | 'contextual';

export interface AdapterNumberSettingField {
  control: 'number';
  key: keyof GalleryBehaviorSettings;
  label: string;
  description: string;
  appliesTo?: AdapterSettingFieldAppliesTo;
  min: number;
  max: number;
  step: number;
  fallback: number;
}

export interface AdapterDimensionSettingField {
  control: 'dimension';
  key: keyof GalleryBehaviorSettings;
  unitKey: keyof GalleryBehaviorSettings;
  label: string;
  description: string;
  appliesTo?: AdapterSettingFieldAppliesTo;
  allowedUnits: readonly string[];
  max: number;
  step: number;
  fallback: number;
}

export interface AdapterSelectSettingField {
  control: 'select';
  key: keyof GalleryBehaviorSettings;
  label: string;
  description: string;
  appliesTo?: AdapterSettingFieldAppliesTo;
  fallback: string;
  options: Array<{
    value: string;
    label: string;
  }>;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

export interface AdapterBooleanSettingField {
  control: 'boolean';
  key: keyof GalleryBehaviorSettings;
  label: string;
  description: string;
  appliesTo?: AdapterSettingFieldAppliesTo;
  fallback: boolean;
}

export interface AdapterTextSettingField {
  control: 'text';
  key: keyof GalleryBehaviorSettings;
  label: string;
  description: string;
  appliesTo?: AdapterSettingFieldAppliesTo;
  fallback: string;
  placeholder?: string;
}

export interface AdapterColorSettingField {
  control: 'color';
  key: keyof GalleryBehaviorSettings;
  label: string;
  description: string;
  appliesTo?: AdapterSettingFieldAppliesTo;
  fallback: string;
}

export type AdapterSettingFieldDefinition =
  | AdapterNumberSettingField
  | AdapterDimensionSettingField
  | AdapterSelectSettingField
  | AdapterBooleanSettingField
  | AdapterTextSettingField
  | AdapterColorSettingField;

export interface AdapterSettingGroupDefinition {
  group: AdapterSettingGroup;
  fields: AdapterSettingFieldDefinition[];
  layout?: AdapterSettingGroupLayout;
  placement?: AdapterSettingGroupPlacement;
  scopeMode?: AdapterSettingGroupScopeMode;
}

export type AdapterOptionContext =
  | 'unified-gallery'
  | 'per-type-gallery'
  | 'per-breakpoint-gallery'
  | 'campaign-override';

export type AdapterMediaScope = GalleryMediaScope;

export interface AdapterSelectionUpdate {
  key: keyof GalleryBehaviorSettings;
  value: GalleryBehaviorSettings[keyof GalleryBehaviorSettings];
}

/** Unified, type-agnostic props every gallery adapter component must accept. */
export interface GalleryAdapterProps {
  /** All media items for this campaign (images + videos, pre-sorted by order). */
  media: MediaItem[];
  settings: GalleryBehaviorSettings;
  /** Measured container dimensions from GallerySectionWrapper. Optional during migration. */
  containerDimensions?: ContainerDimensions;
}

/** Registered metadata for a gallery adapter. */
export interface AdapterRegistration {
  id: GalleryAdapterId;
  label: string;
  aliases?: GalleryAdapterId[];
  optionLabels?: Partial<Record<AdapterOptionContext, string>>;
  capabilities: AdapterCapability[];
  settingGroups: AdapterSettingGroup[];
  supportsMobile?: boolean;
  component: ComponentType<GalleryAdapterProps>;
}
