import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../../test/test-utils';
import { CampaignDuplicateModal } from './CampaignDuplicateModal';
import type { AdminCampaign } from '@/services/adminQuery';

const mockSource: AdminCampaign = {
  id: '42',
  title: 'Summer Campaign',
  description: '',
  companyId: '',
  status: 'active',
  visibility: 'private',
  createdAt: '',
  updatedAt: '',
  tags: [],
  publishAt: '',
  unpublishAt: '',
  layoutTemplateId: '',
  categories: [],
};

const defaults = {
  source: mockSource,
  isSaving: false,
  onConfirm: vi.fn(),
  onClose: vi.fn(),
};

const layoutTemplateSource: AdminCampaign = {
  ...mockSource,
  layoutTemplateId: 'tpl-1',
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
    expect(onConfirm).toHaveBeenCalledWith('Summer Campaign (Copy)', true, false);
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
    expect(onConfirm).toHaveBeenCalledWith('Summer Campaign (Copy)', false, false);
  });

  it('shows layout-template deep-clone toggle when the source has a linked template', () => {
    render(<CampaignDuplicateModal {...defaults} source={layoutTemplateSource} />);
    expect(screen.getByRole('switch', { name: /duplicate linked layout template/i })).toBeInTheDocument();
  });

  it('defaults layout-template deep clone on when the source has a linked template', () => {
    const onConfirm = vi.fn();
    render(<CampaignDuplicateModal {...defaults} source={layoutTemplateSource} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole('button', { name: /duplicate/i }));
    expect(onConfirm).toHaveBeenCalledWith('Summer Campaign (Copy)', true, true);
  });

  it('passes false when layout-template deep clone is disabled', () => {
    const onConfirm = vi.fn();
    render(<CampaignDuplicateModal {...defaults} source={layoutTemplateSource} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole('switch', { name: /duplicate linked layout template/i }));
    fireEvent.click(screen.getByRole('button', { name: /duplicate/i }));
    expect(onConfirm).toHaveBeenCalledWith('Summer Campaign (Copy)', true, false);
  });

  it('shows loading state on Duplicate button while saving', () => {
    render(<CampaignDuplicateModal {...defaults} isSaving={true} />);
    const btn = screen.getByRole('button', { name: /duplicate/i });
    expect(btn).toHaveAttribute('data-loading', 'true');
  });
});
