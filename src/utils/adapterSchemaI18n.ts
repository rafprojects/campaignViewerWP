/**
 * P60-I: Locale resolution for adapter setting-group schema strings.
 *
 * The schema lives in `src/data/adapterSettingGroups.ts` as plain English data
 * literals (SETTING_GROUP_DEFINITIONS + BUILTIN_ADAPTERS). That module is
 * evaluated once at import time — before i18n is guaranteed ready and without
 * re-running on locale change — so its English strings stay as the canonical
 * source of truth and defaults. Translation happens here, at render time, using
 * deterministic keys derived from the group + field key (harvested into the
 * i18n catalogue by the __extract_sg extractor):
 *
 *   set_sg_<group>_<fieldKey>            → field label
 *   set_sg_<group>_<fieldKey>_desc       → field description
 *   set_sg_<group>_<fieldKey>_ph         → text-field placeholder
 *   set_sg_<group>_<fieldKey>_opt_<value>→ select option label
 *   set_adp_<adapterId>[_<context>]      → adapter (option) label
 *
 * Callers must be inside a component that subscribes to i18n (via
 * useTranslation) so a locale switch re-renders and re-resolves these.
 */
import i18n from '@/i18n';
import type { AdapterSettingGroup, AdapterSettingFieldDefinition } from '@/components/Galleries/Adapters/GalleryAdapter';

const NS = { ns: 'wpsg' } as const;

function fieldBaseKey(group: AdapterSettingGroup, field: AdapterSettingFieldDefinition): string {
  return `set_sg_${group}_${String(field.key)}`;
}

/** Translated field label (English literal is the fallback / default). */
export function tFieldLabel(group: AdapterSettingGroup, field: AdapterSettingFieldDefinition): string {
  return i18n.t(fieldBaseKey(group, field), field.label, NS);
}

/** Translated field description. */
export function tFieldDescription(group: AdapterSettingGroup, field: AdapterSettingFieldDefinition): string {
  return i18n.t(`${fieldBaseKey(group, field)}_desc`, field.description, NS);
}

/** Translated text-field placeholder, or undefined when the field has none. */
export function tFieldPlaceholder(group: AdapterSettingGroup, field: AdapterSettingFieldDefinition): string | undefined {
  if (field.control !== 'text' || !field.placeholder) return undefined;
  return i18n.t(`${fieldBaseKey(group, field)}_ph`, field.placeholder, NS);
}

/** Translated select options (value preserved, label localised). */
export function tFieldOptions(
  group: AdapterSettingGroup,
  field: AdapterSettingFieldDefinition,
): Array<{ value: string; label: string }> {
  if (field.control !== 'select') return [];
  const base = fieldBaseKey(group, field);
  return field.options.map((opt) => ({
    value: opt.value,
    label: i18n.t(`${base}_opt_${opt.value}`, opt.label, NS),
  }));
}

/** Translated adapter label for a given option context (falls back to base label). */
export function tAdapterLabel(adapterId: string, englishLabel: string, context?: string): string {
  const key = context ? `set_adp_${adapterId}_${context}` : `set_adp_${adapterId}`;
  return i18n.t(key, englishLabel, NS);
}
