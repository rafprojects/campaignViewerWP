import { useState, useRef } from 'react';
import {
  Modal,
  Button,
  Group,
  Text,
  Stack,
  Alert,
  FileButton,
} from '@mantine/core';
import { IconUpload, IconInfoCircle } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import type { CampaignExportPayload } from '@/services/apiClient';
import { getWpsgDebugProps, setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

interface CampaignImportModalProps {
  opened: boolean;
  isSaving: boolean;
  onImport: (payload: CampaignExportPayload) => void;
  onImportBinary: (file: File) => void;
  onClose: () => void;
}

interface CampaignImportModalContentProps {
  parsed: CampaignExportPayload | null;
  zipFile: File | null;
  parseError: string | null;
  isSaving: boolean;
  resetRef: React.MutableRefObject<(() => void) | null>;
  campaignTitle: string | null;
  onHandleFile: (file: File | null) => void;
  onHandleClose: () => void;
  onHandleImport: () => void;
}

function CampaignImportModalContent({
  parsed,
  zipFile,
  parseError,
  isSaving,
  resetRef,
  campaignTitle,
  onHandleFile,
  onHandleClose,
  onHandleImport,
}: CampaignImportModalContentProps) {
  const { t } = useTranslation('wpsg');
  const hasFile = parsed !== null || zipFile !== null;
  return (
    <Stack {...getWpsgDebugProps('CampaignImportModal', 'stack')} gap="md">
      <Text size="sm" c="dimmed">
        {t('admin_import_desc', 'Select a {{json}} or {{zip}} file exported from WP Super Gallery. Campaigns will be created as drafts — media and layout templates are imported by value.', { json: '.json', zip: '.zip' })}
      </Text>

      <FileButton resetRef={resetRef} onChange={onHandleFile} accept="application/json,.json,.zip,application/zip">
        {(props) => (
          <Button
            {...props}
            variant="outline"
            leftSection={<IconUpload size={16} />}
            fullWidth
          >
            {hasFile ? t('admin_import_change_file', 'Change file') : t('admin_import_select_file', 'Select .json or .zip file')}
          </Button>
        )}
      </FileButton>

      {parseError && (
        <Alert color="red" icon={<IconInfoCircle size={16} />}>
          {parseError}
        </Alert>
      )}

      {parsed && (
        <Alert color="teal" icon={<IconInfoCircle size={16} />}>
          {t('admin_import_ready', 'Ready to import:')} <strong>{campaignTitle}</strong>
          {parsed.media_references?.length
            ? t('admin_import_media_refs', ' ({{count}} media reference)', { count: parsed.media_references.length })
            : ''}
        </Alert>
      )}

      {zipFile && (
        <Alert color="teal" icon={<IconInfoCircle size={16} />}>
          {t('admin_import_ready', 'Ready to import:')} <strong>{zipFile.name}</strong>
        </Alert>
      )}

      <Group {...getWpsgDebugProps('CampaignImportModal', 'actions')} justify="flex-end">
        <Button variant="subtle" onClick={onHandleClose} disabled={isSaving}>
          {t('admin_cancel', 'Cancel')}
        </Button>
        <Button
          disabled={!hasFile}
          loading={isSaving}
          onClick={onHandleImport}
          leftSection={<IconUpload size={16} />}
        >
          {t('admin_import', 'Import')}
        </Button>
      </Group>
    </Stack>
  );
}

setWpsgDebugDisplayName(CampaignImportModalContent, 'AdminPanel:CampaignImportModalContent');

export function CampaignImportModal({
  opened,
  isSaving,
  onImport,
  onImportBinary,
  onClose,
}: CampaignImportModalProps) {
  const { t } = useTranslation('wpsg');
  const [parsed, setParsed] = useState<CampaignExportPayload | null>(null);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const resetRef = useRef<() => void>(null);

  const handleFile = (file: File | null) => {
    setParseError(null);
    setParsed(null);
    setZipFile(null);
    if (!file) return;

    if (file.name.toLowerCase().endsWith('.zip')) {
      setZipFile(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string) as unknown;
        if (
          typeof json !== 'object' ||
          json === null ||
          !('version' in json) ||
          !('campaign' in json)
        ) {
          setParseError(t('admin_import_err_invalid', 'Invalid export file: missing version or campaign key.'));
          return;
        }
        const payload = json as CampaignExportPayload;
        if (payload.version !== 1) {
          setParseError(t('admin_import_err_version', 'Unsupported export version: {{version}}. Expected 1.', { version: payload.version }));
          return;
        }
        setParsed(payload);
      } catch {
        setParseError(t('admin_import_err_parse', 'Could not parse JSON. Make sure the file is a valid campaign export.'));
      }
    };
    reader.readAsText(file);
  };

  const handleClose = () => {
    setParsed(null);
    setZipFile(null);
    setParseError(null);
    resetRef.current?.();
    onClose();
  };

  const handleImport = () => {
    if (zipFile) {
      onImportBinary(zipFile);
    } else if (parsed) {
      onImport(parsed);
    }
  };

  const campaignTitle = parsed
    ? String((parsed.campaign as Record<string, unknown>).title ?? t('admin_untitled', 'Untitled'))
    : null;

  return (
    <Modal
      {...getWpsgDebugProps('CampaignImportModal')}
      opened={opened}
      onClose={handleClose}
      title={<span {...getWpsgDebugProps('CampaignImportModal', 'title')}>{t('admin_import_title', 'Import Campaign')}</span>}
      size="sm"
      centered
      closeButtonProps={getWpsgDebugProps('CampaignImportModal', 'close')}
      overlayProps={getWpsgDebugProps('CampaignImportModal', 'overlay')}
    >
      <CampaignImportModalContent
        parsed={parsed}
        zipFile={zipFile}
        parseError={parseError}
        isSaving={isSaving}
        resetRef={resetRef}
        campaignTitle={campaignTitle}
        onHandleFile={handleFile}
        onHandleClose={handleClose}
        onHandleImport={handleImport}
      />
    </Modal>
  );
}

setWpsgDebugDisplayName(CampaignImportModal, 'AdminPanel:CampaignImportModal');
