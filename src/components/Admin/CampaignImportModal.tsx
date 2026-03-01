import { useState, useRef } from 'react';
import {
  Modal,
  Button,
  Group,
  Text,
  Stack,
  Alert,
  Code,
  FileButton,
} from '@mantine/core';
import { IconUpload, IconInfoCircle } from '@tabler/icons-react';
import type { CampaignExportPayload } from '@/services/apiClient';

interface CampaignImportModalProps {
  opened: boolean;
  isSaving: boolean;
  onImport: (payload: CampaignExportPayload) => void;
  onClose: () => void;
}

export function CampaignImportModal({
  opened,
  isSaving,
  onImport,
  onClose,
}: CampaignImportModalProps) {
  const [parsed, setParsed] = useState<CampaignExportPayload | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const resetRef = useRef<() => void>(null);

  const handleFile = (file: File | null) => {
    setParseError(null);
    setParsed(null);
    if (!file) return;
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
          setParseError('Invalid export file: missing version or campaign key.');
          return;
        }
        const payload = json as CampaignExportPayload;
        if (payload.version !== 1) {
          setParseError(`Unsupported export version: ${payload.version}. Expected 1.`);
          return;
        }
        setParsed(payload);
      } catch {
        setParseError('Could not parse JSON. Make sure the file is a valid campaign export.');
      }
    };
    reader.readAsText(file);
  };

  const handleClose = () => {
    setParsed(null);
    setParseError(null);
    resetRef.current?.();
    onClose();
  };

  const handleImport = () => {
    if (parsed) onImport(parsed);
  };

  const campaignTitle = parsed
    ? String((parsed.campaign as Record<string, unknown>).title ?? 'Untitled')
    : null;

  return (
    <Modal opened={opened} onClose={handleClose} title="Import Campaign" size="sm" centered>
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Select a <Code>.json</Code> file exported from WP Super Gallery. The campaign will be
          created as a draft — media references and layout template are imported by value.
        </Text>

        <FileButton resetRef={resetRef} onChange={handleFile} accept="application/json,.json">
          {(props) => (
            <Button
              {...props}
              variant="outline"
              leftSection={<IconUpload size={16} />}
              fullWidth
            >
              {parsed ? `Change file` : 'Select .json file'}
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
            Ready to import: <strong>{campaignTitle}</strong>
            {parsed.media_references?.length
              ? ` (${parsed.media_references.length} media reference${parsed.media_references.length !== 1 ? 's' : ''})`
              : ''}
          </Alert>
        )}

        <Group justify="flex-end">
          <Button variant="subtle" onClick={handleClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            disabled={!parsed}
            loading={isSaving}
            onClick={handleImport}
            leftSection={<IconUpload size={16} />}
          >
            Import
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
