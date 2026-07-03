import { useCallback, useEffect, useState } from 'react';
import {
  Stack, Group, Button, Text, Badge, ActionIcon, Tooltip,
  Modal, TextInput, Select, Title, Divider, Loader, Center, Textarea,
} from '@mantine/core';
import { IconTrash, IconPlus } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import type { ApiClient, CampaignTemplate } from '@/services/apiClient';
import type { AdminCampaign } from '@/services/adminQuery';
import { getErrorMessage } from '@wp-super-gallery/shared-utils';

interface Props {
  apiClient: ApiClient;
  campaigns: AdminCampaign[];
  onNotify: (msg: { type: 'error' | 'success'; text: string }) => void;
}

export function TemplatesTab({ apiClient, campaigns, onNotify }: Props) {
  const { t } = useTranslation('wpsg');
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
      .catch(() => onNotify({ type: 'error', text: t('admin_tmpl_load_fail', 'Failed to load templates.') }))
      .finally(() => setLoading(false));
  }, [apiClient, onNotify, t]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = useCallback(async (tpl: CampaignTemplate) => {
    setDeletingId(tpl.id);
    try {
      await apiClient.deleteCampaignTemplate(tpl.id);
      onNotify({ type: 'success', text: t('admin_tmpl_deleted', 'Template "{{name}}" deleted.', { name: tpl.name }) });
      load();
    } catch (err) {
      onNotify({ type: 'error', text: getErrorMessage(err, t('admin_tmpl_delete_fail', 'Failed to delete template.')) });
    } finally {
      setDeletingId(null);
    }
  }, [apiClient, onNotify, load, t]);

  const handleCreate = useCallback(async () => {
    if (!createName.trim()) return;
    setIsCreating(true);
    try {
      await apiClient.createCampaignTemplate({
        name: createName.trim(),
        description: createDescription.trim(),
        ...(createSource ? { from_campaign_id: parseInt(createSource, 10) } : {}),
      });
      onNotify({ type: 'success', text: t('admin_tmpl_created', 'Template created.') });
      setCreateOpen(false);
      setCreateName('');
      setCreateDescription('');
      setCreateSource(null);
      load();
    } catch (err) {
      onNotify({ type: 'error', text: getErrorMessage(err, t('admin_tmpl_create_fail', 'Failed to create template.')) });
    } finally {
      setIsCreating(false);
    }
  }, [apiClient, createName, createDescription, createSource, onNotify, load, t]);

  const campaignOptions = campaigns.map((c) => ({ value: c.id, label: c.title }));

  const builtins = templates.filter((tpl) => tpl.source === 'builtin');
  const user = templates.filter((tpl) => tpl.source === 'user');

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={5}>{t('admin_tmpl_title', 'Campaign Templates')}</Title>
        <Button
          size="xs"
          leftSection={<IconPlus size={14} />}
          onClick={() => setCreateOpen(true)}
        >
          {t('admin_tmpl_new', 'New Template')}
        </Button>
      </Group>

      {loading ? (
        <Center py="xl"><Loader size="sm" /></Center>
      ) : (
        <>
          <Text size="sm" fw={500} c="dimmed">{t('admin_tmpl_builtin', 'Built-in')}</Text>
          {builtins.map((tpl) => (
            <TemplateRow key={tpl.id} tpl={tpl} deletingId={deletingId} onDelete={handleDelete} />
          ))}

          <Divider />
          <Text size="sm" fw={500} c="dimmed">{t('admin_tmpl_custom', 'Custom')}</Text>
          {user.length === 0 ? (
            <Text size="sm" c="dimmed">{t('admin_tmpl_no_custom', 'No custom templates yet.')}</Text>
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
        title={t('admin_tmpl_new', 'New Template')}
        size="sm"
        centered
      >
        <Stack gap="sm">
          <TextInput
            label={t('admin_tmpl_name_label', 'Template name')}
            placeholder={t('admin_tmpl_name_ph', 'e.g. Weddings default')}
            value={createName}
            onChange={(e) => setCreateName(e.currentTarget.value)}
            required
          />
          <Textarea
            label={t('admin_tmpl_desc_label', 'Description (optional)')}
            placeholder={t('admin_tmpl_desc_ph', 'e.g. Our standard wedding campaign layout')}
            value={createDescription}
            onChange={(e) => setCreateDescription(e.currentTarget.value)}
            minRows={2}
            maxRows={4}
            description={t('admin_tmpl_char_count', '{{count}} character', { count: descriptionCharacterCount })}
          />
          <Select
            label={t('admin_tmpl_copy_label', 'Copy settings from campaign (optional)')}
            placeholder={t('admin_tmpl_copy_ph', 'Start blank')}
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
            {t('admin_tmpl_create_btn', 'Create Template')}
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
  const { t } = useTranslation('wpsg');
  return (
    <Group justify="space-between" wrap="wrap" px="xs" py={4}>
      <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
        <Group gap="xs" wrap="nowrap">
          <Text size="sm" fw={500} truncate>{tpl.name}</Text>
          <Badge size="xs" variant="light" color={tpl.source === 'builtin' ? 'blue' : 'gray'}>
            {tpl.source === 'builtin' ? t('admin_tmpl_builtin', 'Built-in') : t('admin_tmpl_custom', 'Custom')}
          </Badge>
        </Group>
        {tpl.description && <Text size="xs" c="dimmed" truncate>{tpl.description}</Text>}
      </Stack>
      {tpl.editable && (
        <Tooltip label={t('admin_tmpl_delete_tt', 'Delete template')}>
          <ActionIcon
            variant="subtle"
            color="red"
            size="sm"
            loading={deletingId === tpl.id}
            onClick={() => onDelete(tpl)}
            aria-label={t('admin_tmpl_delete_aria', 'Delete template {{name}}', { name: tpl.name })}
          >
            <IconTrash size={14} />
          </ActionIcon>
        </Tooltip>
      )}
    </Group>
  );
}
