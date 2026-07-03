import { useEffect, useState, type CSSProperties } from 'react';
import { Modal, SimpleGrid, Card, Text, Badge, Stack, Group, Loader, Center } from '@mantine/core';
import { IconLayoutGrid } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import type { ApiClient, CampaignTemplate } from '@/services/apiClient';
import classes from './TemplatePickerModal.module.scss';

type TemplateCardStyle = CSSProperties & Record<'--wpsg-glow-color', string>;

function buildTemplateCardStyle(glowColor: string): TemplateCardStyle {
  return {
    cursor: 'pointer',
    '--wpsg-glow-color': glowColor,
  };
}

interface Props {
  opened: boolean;
  onClose: () => void;
  apiClient: ApiClient;
  /** Null = "Start Blank" selected. */
  onSelect: (template: CampaignTemplate | null) => void;
}

export function TemplatePickerModal({ opened, onClose, apiClient, onSelect }: Props) {
  const { t } = useTranslation('wpsg');
  const [templates, setTemplates] = useState<CampaignTemplate[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!opened) return;
    setLoading(true);
    apiClient.listCampaignTemplates()
      .then(setTemplates)
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false));
  }, [opened, apiClient]);

  const pick = (template: CampaignTemplate | null) => {
    onSelect(template);
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t('admin_tpick_title', 'Choose a starting point')}
      size="lg"
      centered
    >
      {loading ? (
        <Center py="xl"><Loader size="sm" /></Center>
      ) : (
        <SimpleGrid cols={{ base: 1, xs: 2, sm: 3 }} spacing="sm">
          {/* Always-first "Start Blank" card */}
          <Card
            withBorder
            radius="md"
            padding="md"
            className={classes.card!}
            style={buildTemplateCardStyle('var(--mantine-color-gray-6)')}
            onClick={() => pick(null)}
          >
            <Stack gap={4}>
              <Group gap="xs" wrap="nowrap">
                <IconLayoutGrid size={16} />
                <Text fw={600} size="sm" truncate>{t('admin_tpick_start_blank', 'Start Blank')}</Text>
              </Group>
              <Text size="xs" c="dimmed">{t('admin_tpick_no_settings', 'No pre-configured settings.')}</Text>
            </Stack>
          </Card>

          {templates.map((tpl) => {
            const glowColor =
              tpl.source === 'builtin'
                ? 'var(--mantine-color-blue-6)'
                : 'var(--mantine-color-green-6)';
            return (
              <Card
                key={tpl.id}
                withBorder
                radius="md"
                padding="md"
                className={classes.card!}
                style={buildTemplateCardStyle(glowColor)}
                onClick={() => pick(tpl)}
              >
                <Stack gap={4}>
                  <Group gap="xs" wrap="nowrap" justify="space-between">
                    <Text fw={600} size="sm" truncate style={{ flex: 1 }}>{tpl.name}</Text>
                    <Badge size="xs" variant="light" color={tpl.source === 'builtin' ? 'blue' : 'gray'}>
                      {tpl.source === 'builtin' ? t('admin_tpick_builtin', 'Built-in') : t('admin_tpick_custom', 'Custom')}
                    </Badge>
                  </Group>
                  {tpl.description && (
                    <Text size="xs" c="dimmed" lineClamp={2}>{tpl.description}</Text>
                  )}
                </Stack>
              </Card>
            );
          })}
        </SimpleGrid>
      )}
    </Modal>
  );
}
