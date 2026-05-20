import { useCallback, useEffect, useState } from 'react';
import {
  Stack, Group, Button, Text, Badge, ActionIcon, Tooltip,
  Modal, TextInput, Select, Title, Divider, Loader, Center, Textarea,
} from '@mantine/core';
import { IconTrash, IconPlus } from '@tabler/icons-react';
import type { ApiClient, CampaignTemplate } from '@/services/apiClient';
import type { AdminCampaign } from '@/services/adminQuery';
import { getErrorMessage } from '@/utils/getErrorMessage';

interface Props {
  apiClient: ApiClient;
  campaigns: AdminCampaign[];
  onNotify: (msg: { type: 'error' | 'success'; text: string }) => void;
}

export function TemplatesTab({ apiClient, campaigns, onNotify }: Props) {
  const [templates, setTemplates] = useState<CampaignTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createSource, setCreateSource] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const descriptionCharacterCount = createDescription.length;

  const load = useCallback(() => {
    setLoading(true);
    apiClient.listCampaignTemplates()
      .then(setTemplates)
      .catch(() => onNotify({ type: 'error', text: 'Failed to load templates.' }))
      .finally(() => setLoading(false));
  }, [apiClient, onNotify]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = useCallback(async (tpl: CampaignTemplate) => {
    setDeletingId(tpl.id);
    try {
      await apiClient.deleteCampaignTemplate(tpl.id);
      onNotify({ type: 'success', text: `Template "${tpl.name}" deleted.` });
      load();
    } catch (err) {
      onNotify({ type: 'error', text: getErrorMessage(err, 'Failed to delete template.') });
    } finally {
      setDeletingId(null);
    }
  }, [apiClient, onNotify, load]);

  const handleCreate = useCallback(async () => {
    if (!createName.trim()) return;
    setIsCreating(true);
    try {
      await apiClient.createCampaignTemplate({
        name: createName.trim(),
        description: createDescription.trim(),
        ...(createSource ? { from_campaign_id: parseInt(createSource, 10) } : {}),
      });
      onNotify({ type: 'success', text: 'Template created.' });
      setCreateOpen(false);
      setCreateName('');
      setCreateDescription('');
      setCreateSource(null);
      load();
    } catch (err) {
      onNotify({ type: 'error', text: getErrorMessage(err, 'Failed to create template.') });
    } finally {
      setIsCreating(false);
    }
  }, [apiClient, createName, createDescription, createSource, onNotify, load]);

  const campaignOptions = campaigns.map((c) => ({ value: c.id, label: c.title }));

  const builtins = templates.filter((t) => t.source === 'builtin');
  const user = templates.filter((t) => t.source === 'user');

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={5}>Campaign Templates</Title>
        <Button
          size="xs"
          leftSection={<IconPlus size={14} />}
          onClick={() => setCreateOpen(true)}
        >
          New Template
        </Button>
      </Group>

      {loading ? (
        <Center py="xl"><Loader size="sm" /></Center>
      ) : (
        <>
          <Text size="sm" fw={500} c="dimmed">Built-in</Text>
          {builtins.map((tpl) => (
            <TemplateRow key={tpl.id} tpl={tpl} deletingId={deletingId} onDelete={handleDelete} />
          ))}

          <Divider />
          <Text size="sm" fw={500} c="dimmed">Custom</Text>
          {user.length === 0 ? (
            <Text size="sm" c="dimmed">No custom templates yet.</Text>
          ) : (
            user.map((tpl) => (
              <TemplateRow key={tpl.id} tpl={tpl} deletingId={deletingId} onDelete={handleDelete} />
            ))
          )}
        </>
      )}

      <Modal
        opened={createOpen}
        onClose={() => { setCreateOpen(false); setCreateName(''); setCreateDescription(''); setCreateSource(null); }}
        title="New Template"
        size="sm"
        centered
      >
        <Stack gap="sm">
          <TextInput
            label="Template name"
            placeholder="e.g. Weddings default"
            value={createName}
            onChange={(e) => setCreateName(e.currentTarget.value)}
            required
          />
          <Textarea
            label="Description (optional)"
            placeholder="e.g. Our standard wedding campaign layout"
            value={createDescription}
            onChange={(e) => setCreateDescription(e.currentTarget.value)}
            minRows={2}
            maxRows={4}
            description={`${descriptionCharacterCount} character${descriptionCharacterCount === 1 ? '' : 's'}`}
          />
          <Select
            label="Copy settings from campaign (optional)"
            placeholder="Start blank"
            data={campaignOptions}
            value={createSource}
            onChange={setCreateSource}
            clearable
            searchable
          />
          <Button
            fullWidth
            onClick={handleCreate}
            loading={isCreating}
            disabled={!createName.trim()}
          >
            Create Template
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}

function TemplateRow({
  tpl,
  deletingId,
  onDelete,
}: {
  tpl: CampaignTemplate;
  deletingId: string | null;
  onDelete: (tpl: CampaignTemplate) => void;
}) {
  return (
    <Group justify="space-between" wrap="wrap" px="xs" py={4}>
      <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
        <Group gap="xs" wrap="nowrap">
          <Text size="sm" fw={500} truncate>{tpl.name}</Text>
          <Badge size="xs" variant="light" color={tpl.source === 'builtin' ? 'blue' : 'gray'}>
            {tpl.source === 'builtin' ? 'Built-in' : 'Custom'}
          </Badge>
        </Group>
        {tpl.description && <Text size="xs" c="dimmed" truncate>{tpl.description}</Text>}
      </Stack>
      {tpl.editable && (
        <Tooltip label="Delete template">
          <ActionIcon
            variant="subtle"
            color="red"
            size="sm"
            loading={deletingId === tpl.id}
            onClick={() => onDelete(tpl)}
            aria-label={`Delete template ${tpl.name}`}
          >
            <IconTrash size={14} />
          </ActionIcon>
        </Tooltip>
      )}
    </Group>
  );
}
