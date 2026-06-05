import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@/test/test-utils';
import { AdminCampaignBulkConfirmModal } from './AdminCampaignBulkConfirmModal';

const defaults = {
  opened: true,
  count: 3,
  loading: false,
  onClose: vi.fn(),
  onConfirm: vi.fn(),
};

describe('AdminCampaignBulkConfirmModal — archive action', () => {
  it('renders title with campaign count', () => {
    render(<AdminCampaignBulkConfirmModal {...defaults} action="archive" />);
    expect(screen.getByText(/archive 3 campaigns\?/i)).toBeInTheDocument();
  });

  it('uses singular label for count of 1', () => {
    render(<AdminCampaignBulkConfirmModal {...defaults} action="archive" count={1} />);
    expect(screen.getByText(/archive 1 campaign\?/i)).toBeInTheDocument();
  });

  it('confirm button has correct label and color', () => {
    render(<AdminCampaignBulkConfirmModal {...defaults} action="archive" />);
    expect(screen.getByRole('button', { name: /archive 3 campaigns/i })).toBeInTheDocument();
  });

  it('calls onConfirm when confirm button clicked', () => {
    const onConfirm = vi.fn();
    render(<AdminCampaignBulkConfirmModal {...defaults} action="archive" onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole('button', { name: /archive 3 campaigns/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn();
    render(<AdminCampaignBulkConfirmModal {...defaults} action="archive" onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('AdminCampaignBulkConfirmModal — restore action', () => {
  it('renders title with campaign count', () => {
    render(<AdminCampaignBulkConfirmModal {...defaults} action="restore" />);
    expect(screen.getByText(/restore 3 campaigns\?/i)).toBeInTheDocument();
  });

  it('uses singular label for count of 1', () => {
    render(<AdminCampaignBulkConfirmModal {...defaults} action="restore" count={1} />);
    expect(screen.getByText(/restore 1 campaign\?/i)).toBeInTheDocument();
  });

  it('confirm button has correct label', () => {
    render(<AdminCampaignBulkConfirmModal {...defaults} action="restore" />);
    expect(screen.getByRole('button', { name: /restore 3 campaigns/i })).toBeInTheDocument();
  });

  it('calls onConfirm when confirm button clicked', () => {
    const onConfirm = vi.fn();
    render(<AdminCampaignBulkConfirmModal {...defaults} action="restore" onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole('button', { name: /restore 3 campaigns/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn();
    render(<AdminCampaignBulkConfirmModal {...defaults} action="restore" onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
