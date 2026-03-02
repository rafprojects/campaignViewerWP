import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../../test/test-utils';
import { CampaignDuplicateModal } from './CampaignDuplicateModal';
import type { AdminCampaign } from '@/hooks/useAdminSWR';

const mockSource: AdminCampaign = {
  id: 42,
  title: 'Summer Campaign',
  description: '',
  company: '',
  companyId: '',
  status: 'active',
  visibility: 'private',
  tags: '',
  publishAt: '',
  unpublishAt: '',
  layoutTemplateId: '',
  imageAdapterId: '',
  videoAdapterId: '',
  categories: [],
};

const defaults = {
  source: mockSource,
  isSaving: false,
  onConfirm: vi.fn(),
  onClose: vi.fn(),
};

describe('CampaignDuplicateModal', () => {
  it('renders nothing when source is null', () => {
    render(<CampaignDuplicateModal {...defaults} source={null} />);
    expect(screen.queryByText('Duplicate Campaign')).not.toBeInTheDocument();
  });

  it('renders when source is provided', () => {
    render(<CampaignDuplicateModal {...defaults} />);
    expect(screen.getByText('Duplicate Campaign')).toBeInTheDocument();
  });

  it('pre-fills the name field with "<title> (Copy)"', () => {
    render(<CampaignDuplicateModal {...defaults} />);
    const input = screen.getByLabelText(/new name/i) as HTMLInputElement;
    expect(input.value).toBe('Summer Campaign (Copy)');
  });

  it('shows the source campaign title', () => {
    render(<CampaignDuplicateModal {...defaults} />);
    expect(screen.getByText('Summer Campaign')).toBeInTheDocument();
  });

  it('calls onConfirm with trimmed name and copyMedia when Duplicate is clicked', () => {
    const onConfirm = vi.fn();
    render(<CampaignDuplicateModal {...defaults} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole('button', { name: /duplicate/i }));
    expect(onConfirm).toHaveBeenCalledWith('Summer Campaign (Copy)', true);
  });

  it('Duplicate button is disabled when name is empty', () => {
    render(<CampaignDuplicateModal {...defaults} />);
    const input = screen.getByLabelText(/new name/i);
    fireEvent.change(input, { target: { value: '   ' } });
    expect(screen.getByRole('button', { name: /duplicate/i })).toBeDisabled();
  });

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn();
    render(<CampaignDuplicateModal {...defaults} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('toggles copy media switch and passes false to onConfirm', () => {
    const onConfirm = vi.fn();
    render(<CampaignDuplicateModal {...defaults} onConfirm={onConfirm} />);
    // Mantine Switch renders with role="switch"
    const switchEl = screen.getByRole('switch', { name: /copy media/i });
    fireEvent.click(switchEl); // uncheck
    fireEvent.click(screen.getByRole('button', { name: /duplicate/i }));
    expect(onConfirm).toHaveBeenCalledWith('Summer Campaign (Copy)', false);
  });

  it('shows loading state on Duplicate button while saving', () => {
    render(<CampaignDuplicateModal {...defaults} isSaving={true} />);
    const btn = screen.getByRole('button', { name: /duplicate/i });
    expect(btn).toHaveAttribute('data-loading', 'true');
  });
});
