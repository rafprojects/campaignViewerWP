import { Button, Card, ColorInput, Group, Modal, Select, Stack, Text, TextInput, Textarea } from '@mantine/core';
import type { Campaign } from '@/types';
import { useDirtyGuard } from '@/hooks/useDirtyGuard';
import { ConfirmModal } from '@/components/shared/ConfirmModal';

/** Convert an ISO 8601 date string to the `datetime-local` input value format (YYYY-MM-DDTHH:MM). */
function toLocalInputValue(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export interface CampaignFormState {
  title: string;
  description: string;
  company: string;
  status: Campaign['status'];
  visibility: Campaign['visibility'];
  tags: string;
  borderColor?: string;
  /** P13-D: ISO 8601 scheduled-publish date (empty = immediate). */
  publishAt: string;
  /** P13-D: ISO 8601 auto-unpublish date (empty = never). */
  unpublishAt: string;
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
  /** When 'individual', show per-card border color picker */
  cardBorderMode?: 'single' | 'auto' | 'individual';
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
  cardBorderMode,
}: CampaignFormModalProps) {
  const { confirmOpen, guardedClose, confirmDiscard, cancelDiscard } = useDirtyGuard({
    current: formState,
    isOpen: opened,
    onClose,
  });

  return (
    <>
    <Modal
      opened={opened}
      onClose={guardedClose}
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
        <Group grow wrap="wrap" gap="sm">
          <TextInput
            type="datetime-local"
            label="Publish At"
            description="Campaign becomes visible at this date/time (leave empty for immediate)"
            value={formState.publishAt ? toLocalInputValue(formState.publishAt) : ''}
            onChange={(e) => onFormChange({ ...formState, publishAt: e.currentTarget.value ? new Date(e.currentTarget.value).toISOString() : '' })}
          />
          <TextInput
            type="datetime-local"
            label="Unpublish At"
            description="Campaign is hidden after this date/time (leave empty for never)"
            value={formState.unpublishAt ? toLocalInputValue(formState.unpublishAt) : ''}
            onChange={(e) => onFormChange({ ...formState, unpublishAt: e.currentTarget.value ? new Date(e.currentTarget.value).toISOString() : '' })}
          />
        </Group>
        {editingCampaign && cardBorderMode === 'individual' && (
          <ColorInput
            label="Card Border Color"
            description="Custom accent border color for this campaign card"
            value={formState.borderColor ?? ''}
            onChange={(v) => onFormChange({ ...formState, borderColor: v || undefined })}
            placeholder="Auto (company brand color)"
          />
        )}
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
          <Button variant="default" onClick={guardedClose}>
            Cancel
          </Button>
          <Button onClick={onSave} loading={isSaving}>
            {editingCampaign ? 'Save Changes' : 'Create Campaign'}
          </Button>
        </Group>
      </Stack>
    </Modal>

    <ConfirmModal
      opened={confirmOpen}
      onClose={cancelDiscard}
      onConfirm={confirmDiscard}
      title="Discard changes?"
      message="You have unsaved changes. Are you sure you want to discard them?"
      confirmLabel="Discard"
      confirmColor="red"
    />
  </>
  );
}
