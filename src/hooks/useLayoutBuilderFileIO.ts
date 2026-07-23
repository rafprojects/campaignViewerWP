import { useCallback, useRef } from 'react';
import { notifications } from '@mantine/notifications';
import i18n from '@/i18n';
import type { UseLayoutBuilderReturn } from './useLayoutBuilderState';
import { createEmptyTemplate } from './useLayoutBuilderState';
import type { LayoutTemplate } from '@/types';

// [P71-E] Notification copy routed through the shared i18next instance (outside JSX).
const t = i18n.t.bind(i18n);

export function useLayoutBuilderFileIO({ builder }: { builder: UseLayoutBuilderReturn }) {
  const importFileRef = useRef<HTMLInputElement>(null);

  const handleExportJson = useCallback(() => {
    const json = JSON.stringify(builder.template, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = builder.template.name.replace(/[^a-z0-9_-]/gi, '-') || 'layout';
    a.href = url;
    a.download = `${safeName}.wpsg-layout.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [builder.template]);

  const handleImportJson = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const parsed = JSON.parse(ev.target?.result as string) as unknown;
          if (
            typeof parsed !== 'object' ||
            parsed === null ||
            !('name' in parsed) ||
            !('slots' in parsed) ||
            !Array.isArray((parsed as { slots: unknown }).slots) ||
            !('canvasAspectRatio' in parsed)
          ) {
            notifications.show({
              title: t('lbfileio_invalid_title', 'Invalid layout file'),
              message: t('lbfileio_invalid_message', 'The file is missing required fields (name, slots, canvasAspectRatio).'),
              color: 'red',
              autoClose: 5000,
            });
            return;
          }
          const defaults = createEmptyTemplate();
          const imported: LayoutTemplate = {
            ...defaults,
            ...(parsed as Partial<LayoutTemplate>),
            id: '',
            createdAt: defaults.createdAt,
            updatedAt: defaults.updatedAt,
          };
          builder.setTemplate(imported, { preserveSelection: false });
          notifications.show({
            title: t('lbfileio_imported_title', 'Layout imported'),
            message: t('lbfileio_imported_message', '"{{name}}" loaded successfully.', { name: imported.name }),
            color: 'green',
            autoClose: 3000,
          });
        } catch {
          notifications.show({
            title: t('lbfileio_import_failed_title', 'Import failed'),
            message: t('lbfileio_import_failed_message', 'Could not parse JSON file.'),
            color: 'red',
            autoClose: 5000,
          });
        } finally {
          // Reset so same file can be re-imported
          if (importFileRef.current) importFileRef.current.value = '';
        }
      };
      reader.readAsText(file);
    },
    [builder],
  );

  return { importFileRef, handleExportJson, handleImportJson };
}
