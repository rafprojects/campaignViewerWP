import { Button, Card, Group, Modal, Select, Stack, Text, TextInput, Textarea } from '@mantine/core';
import type { Campaign } from '@/types';

export interface CampaignFormState {
  title: string;
  description: string;
  company: string;
  status: Campaign['status'];
  visibility: Campaign['visibility'];
  tags: string;
}

interface CampaignFormModalProps {
  opened: boolean;
  editingCampaign: Pick<Campaign, 'id'> | null;
  formState: CampaignFormState;
  onFormChange: (next: CampaignFormState) => void;
  onClose: () => void;
  onSave: () => void;
  isSaving: boolean;
  onGoToMedia?: (campaignId: string) => void;
}

export function CampaignFormModal({
  opened,
  editingCampaign,
  formState,
  onFormChange,
  onClose,
  onSave,
  isSaving,
  onGoToMedia,
}: CampaignFormModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={editingCampaign ? 'Edit Campaign' : 'New Campaign'}
      size="lg"
    >
      <Stack gap="md">
        <TextInput
          label="Title"
          placeholder="Campaign title"
          value={formState.title}
          onChange={(e) => onFormChange({ ...formState, title: e.currentTarget.value })}
          required
          description="A unique name for this campaign"
        />
        <Textarea
          label="Description"
          placeholder="Campaign description"
          value={formState.description}
          onChange={(e) => onFormChange({ ...formState, description: e.currentTarget.value })}
          minRows={3}
          description="Brief overview of the campaign content"
        />
        <Group grow wrap="wrap" gap="sm">
          <TextInput
            label="Company Slug"
            placeholder="company-id"
            value={formState.company}
            onChange={(e) => onFormChange({ ...formState, company: e.currentTarget.value })}
            required
            description="Unique identifier for the company"
          />
          <Select
            label="Status"
            data={[
              { value: 'draft', label: 'Draft' },
              { value: 'active', label: 'Active' },
              { value: 'archived', label: 'Archived' },
            ]}
            value={formState.status}
            onChange={(v) => onFormChange({ ...formState, status: (v ?? 'draft') as Campaign['status'] })}
          />
          <Select
            label="Visibility"
            data={[
              { value: 'private', label: 'Private' },
              { value: 'public', label: 'Public' },
            ]}
            value={formState.visibility}
            onChange={(v) => onFormChange({ ...formState, visibility: (v ?? 'private') as Campaign['visibility'] })}
          />
        </Group>
        <TextInput
          label="Tags"
          placeholder="tag1, tag2, tag3"
          description="Comma separated list of tags"
          value={formState.tags}
          onChange={(e) => onFormChange({ ...formState, tags: e.currentTarget.value })}
        />
        {editingCampaign && onGoToMedia && (
          <Card withBorder p="sm">
            <Group justify="space-between">
              <Text size="sm" c="dimmed">
                To manage media for this campaign, save changes and go to the Media tab.
              </Text>
              <Button
                variant="light"
                size="xs"
                onClick={() => onGoToMedia(editingCampaign.id)}
              >
                Go to Media
              </Button>
            </Group>
          </Card>
        )}
        <Group justify="flex-end" mt="md" wrap="wrap" gap="sm">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSave} loading={isSaving}>
            {editingCampaign ? 'Save Changes' : 'Create Campaign'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
