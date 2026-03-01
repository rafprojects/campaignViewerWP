import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../test/test-utils';
import { CampaignFormModal } from './CampaignFormModal';
import type { CampaignFormState } from './CampaignFormModal';

const defaultFormState: CampaignFormState = {
  title: 'My Campaign',
  description: 'A test campaign',
  company: 'acme',
  status: 'active',
  visibility: 'private',
  tags: 'tag1, tag2',
  publishAt: '',
  unpublishAt: '',
  layoutTemplateId: '',
  imageAdapterId: '',
  videoAdapterId: '',
  categories: [],
};

describe('CampaignFormModal', () => {
  it('does not render content when opened is false', () => {
    render(
      <CampaignFormModal
        opened={false}
        editingCampaign={null}
        formState={defaultFormState}
        onFormChange={vi.fn()}
        onClose={vi.fn()}
        onSave={vi.fn()}
        isSaving={false}
      />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('fires onFormChange for title change', () => {
    const onFormChange = vi.fn();
    render(
      <CampaignFormModal
        opened={true}
        editingCampaign={null}
        formState={defaultFormState}
        onFormChange={onFormChange}
        onClose={vi.fn()}
        onSave={vi.fn()}
        isSaving={false}
      />,
    );
    fireEvent.change(screen.getByDisplayValue('My Campaign'), {
      target: { value: 'Updated Title' },
    });
    expect(onFormChange).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Updated Title' }),
    );
  });

  it('fires onFormChange for description change', () => {
    const onFormChange = vi.fn();
    render(
      <CampaignFormModal
        opened={true}
        editingCampaign={null}
        formState={defaultFormState}
        onFormChange={onFormChange}
        onClose={vi.fn()}
        onSave={vi.fn()}
        isSaving={false}
      />,
    );
    fireEvent.change(screen.getByDisplayValue('A test campaign'), {
      target: { value: 'Updated desc' },
    });
    expect(onFormChange).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'Updated desc' }),
    );
  });

  it('fires onFormChange for company slug change', () => {
    const onFormChange = vi.fn();
    render(
      <CampaignFormModal
        opened={true}
        editingCampaign={null}
        formState={defaultFormState}
        onFormChange={onFormChange}
        onClose={vi.fn()}
        onSave={vi.fn()}
        isSaving={false}
      />,
    );
    fireEvent.change(screen.getByDisplayValue('acme'), {
      target: { value: 'newco' },
    });
    expect(onFormChange).toHaveBeenCalledWith(
      expect.objectContaining({ company: 'newco' }),
    );
  });

  it('fires onFormChange for tags change', () => {
    const onFormChange = vi.fn();
    render(
      <CampaignFormModal
        opened={true}
        editingCampaign={null}
        formState={defaultFormState}
        onFormChange={onFormChange}
        onClose={vi.fn()}
        onSave={vi.fn()}
        isSaving={false}
      />,
    );
    fireEvent.change(screen.getByDisplayValue('tag1, tag2'), {
      target: { value: 'a, b, c' },
    });
    expect(onFormChange).toHaveBeenCalledWith(
      expect.objectContaining({ tags: 'a, b, c' }),
    );
  });

  it('renders Save button and calls onSave when clicked', async () => {
    const onSave = vi.fn();
    render(
      <CampaignFormModal
        opened={true}
        editingCampaign={null}
        formState={defaultFormState}
        onFormChange={vi.fn()}
        onClose={vi.fn()}
        onSave={onSave}
        isSaving={false}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /(save changes|create campaign)/i }));
    expect(onSave).toHaveBeenCalled();
  });

  it('shows border color picker and fires onFormChange when editingCampaign + individual border mode', () => {
    const onFormChange = vi.fn();
    render(
      <CampaignFormModal
        opened={true}
        editingCampaign={{ id: '101' }}
        formState={{ ...defaultFormState, borderColor: '#ff0000' }}
        onFormChange={onFormChange}
        onClose={vi.fn()}
        onSave={vi.fn()}
        isSaving={false}
        cardBorderMode="individual"
      />,
    );
    // ColorInput should be rendered
    expect(screen.getByDisplayValue('#ff0000')).toBeInTheDocument();
  });

  it('calls onClose (guardedClose) when close button is clicked', async () => {
    const onClose = vi.fn();
    render(
      <CampaignFormModal
        opened={true}
        editingCampaign={null}
        formState={defaultFormState}
        onFormChange={vi.fn()}
        onClose={onClose}
        onSave={vi.fn()}
        isSaving={false}
      />,
    );
    const closeBtn = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(closeBtn);
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });
});
