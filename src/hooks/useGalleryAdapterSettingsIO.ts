import { useCallback, useRef } from 'react';
import { notifications } from '@mantine/notifications';
import i18n from '@/i18n';
import { BUILTIN_ADAPTERS, SETTING_GROUP_DEFINITIONS } from '@/data/adapterSettingGroups';
import { GalleryConfigSchema } from '@/types/settingsSchemas';
import type { GalleryConfig } from '@/types';
import type { UpdateGallerySetting } from '@/components/Settings/GalleryAdapterSettingsSection';

// [P71-E] Notification copy routed through the shared i18next instance (outside JSX).
// (The `validateImportPayload` error strings shown as `message: result.error`
// live in a separate pure validator and are a broader pre-existing i18n gap,
// intentionally out of F-1's direct notification-literal scope.)
const t = i18n.t.bind(i18n);

const VALID_ADAPTER_IDS: ReadonlySet<string> = new Set(BUILTIN_ADAPTERS.map((a) => a.id));

const VALID_ADAPTER_SETTING_KEYS: ReadonlySet<string> = new Set(
  Object.values(SETTING_GROUP_DEFINITIONS).flatMap((group) =>
    group.fields.flatMap((field) => {
      const keys: string[] = [field.key as string];
      if ('unitKey' in field && typeof (field as { unitKey?: unknown }).unitKey === 'string') {
        keys.push((field as { unitKey: string }).unitKey);
      }
      return keys;
    }),
  ),
);

type ValidationResult =
  | { ok: true; config: GalleryConfig }
  | { ok: false; error: string };

function validateImportPayload(parsed: unknown): ValidationResult {
  if (typeof parsed !== 'object' || parsed === null) {
    return { ok: false, error: 'Expected a JSON object.' };
  }

  const raw = parsed as Record<string, unknown>;
  // Accept both the wrapped export format { galleryConfig: ... } and a bare GalleryConfig.
  const configInput = 'galleryConfig' in raw ? raw.galleryConfig : raw;

  const schemaResult = GalleryConfigSchema.safeParse(configInput);
  if (!schemaResult.success) {
    return { ok: false, error: 'Invalid gallery config structure.' };
  }

  const config = schemaResult.data;

  for (const bp of ['desktop', 'tablet', 'mobile'] as const) {
    for (const scope of ['unified', 'image', 'video'] as const) {
      const scopeConfig = config.breakpoints?.[bp]?.[scope];
      if (!scopeConfig) continue;

      const { adapterId, adapterSettings } = scopeConfig;

      if (adapterId !== undefined && !VALID_ADAPTER_IDS.has(adapterId)) {
        return {
          ok: false,
          error: `Unknown adapter ID "${adapterId}" (${bp} ${scope}). Valid IDs: ${[...VALID_ADAPTER_IDS].join(', ')}.`,
        };
      }

      if (adapterSettings !== undefined) {
        const unknownKeys = Object.keys(adapterSettings).filter(
          (k) => !VALID_ADAPTER_SETTING_KEYS.has(k),
        );
        if (unknownKeys.length > 0) {
          return {
            ok: false,
            error: `Unknown adapter setting keys in ${bp} ${scope}: ${unknownKeys.join(', ')}.`,
          };
        }
      }
    }
  }

  return { ok: true, config: config as GalleryConfig };
}

export function useGalleryAdapterSettingsIO({
  galleryConfig,
  updateSetting,
}: {
  galleryConfig: GalleryConfig | undefined;
  updateSetting: UpdateGallerySetting;
}) {
  const importFileRef = useRef<HTMLInputElement>(null);

  const handleExport = useCallback(() => {
    if (!galleryConfig) {
      notifications.show({
        title: t('gasettings_nothing_title', 'Nothing to export'),
        message: t('gasettings_nothing_message', 'No gallery adapter settings have been configured yet.'),
        color: 'yellow',
        autoClose: 4000,
      });
      return;
    }
    const payload = {
      version: '1',
      exportedAt: new Date().toISOString(),
      galleryConfig,
    };
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gallery-adapter-settings.wpsg.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }, [galleryConfig]);

  const handleImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const raw = JSON.parse(ev.target?.result as string) as unknown;
          const result = validateImportPayload(raw);

          if (!result.ok) {
            notifications.show({
              title: t('gasettings_invalid_title', 'Invalid settings file'),
              message: result.error,
              color: 'red',
              autoClose: 6000,
            });
            return;
          }

          updateSetting('galleryConfig', result.config);
          notifications.show({
            title: t('gasettings_imported_title', 'Adapter settings imported'),
            message: t('gasettings_imported_message', 'Gallery adapter settings applied. Save to persist.'),
            color: 'green',
            autoClose: 3000,
          });
        } catch {
          notifications.show({
            title: t('gasettings_import_failed_title', 'Import failed'),
            message: t('gasettings_import_failed_message', 'Could not parse JSON file.'),
            color: 'red',
            autoClose: 5000,
          });
        } finally {
          if (importFileRef.current) importFileRef.current.value = '';
        }
      };
      reader.onerror = () => {
        notifications.show({
          title: t('gasettings_import_failed_title', 'Import failed'),
          message: t('gasettings_read_failed_message', 'Could not read the selected file.'),
          color: 'red',
          autoClose: 5000,
        });
        if (importFileRef.current) importFileRef.current.value = '';
      };
      reader.readAsText(file);
    },
    [updateSetting],
  );

  return { importFileRef, handleExport, handleImport };
}
