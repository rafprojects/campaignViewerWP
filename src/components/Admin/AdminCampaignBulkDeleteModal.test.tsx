import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@/test/test-utils';
import { AdminCampaignBulkDeleteModal } from './AdminCampaignBulkDeleteModal';

const defaults = {
  opened: true,
  count: 3,
  loading: false,
  onClose: vi.fn(),
  onConfirm: vi.fn(),
};

describe('AdminCampaignBulkDeleteModal', () => {
  it('renders title with campaign count', () => {
    render(<AdminCampaignBulkDeleteModal {...defaults} count={3} />);
    expect(screen.getByText(/delete 3 campaigns\?/i)).toBeInTheDocument();
  });

  it('uses singular label for count of 1', () => {
    render(<AdminCampaignBulkDeleteModal {...defaults} count={1} />);
    expect(screen.getByText(/delete 1 campaign\?/i)).toBeInTheDocument();
  });

  it('confirm button is enabled by default', () => {
    render(<AdminCampaignBulkDeleteModal {...defaults} />);
    expect(screen.getByRole('button', { name: /delete 3 campaigns/i })).not.toBeDisabled();
  });

  it('calls onConfirm with purgeAnalytics false by default', () => {
    const onConfirm = vi.fn();
    render(<AdminCampaignBulkDeleteModal {...defaults} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole('button', { name: /delete 3 campaigns/i }));
    expect(onConfirm).toHaveBeenCalledWith({ purgeAnalytics: false });
  });

  it('calls onConfirm with purgeAnalytics true when checkbox is checked', () => {
    const onConfirm = vi.fn();
    render(<AdminCampaignBulkDeleteModal {...defaults} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByLabelText(/purge all analytics/i));
    fireEvent.click(screen.getByRole('button', { name: /delete 3 campaigns/i }));
    expect(onConfirm).toHaveBeenCalledWith({ purgeAnalytics: true });
  });

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn();
    render(<AdminCampaignBulkDeleteModal {...defaults} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('disables buttons and shows loading state', () => {
    render(<AdminCampaignBulkDeleteModal {...defaults} loading={true} />);
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
    const confirmBtn = screen.getByRole('button', { name: /delete 3 campaigns/i });
    expect(confirmBtn).toBeDisabled();
  });
});
