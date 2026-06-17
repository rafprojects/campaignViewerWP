import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../../test/test-utils';
import { CampaignsTab } from './CampaignsTab';

const defaultProps = {
  isLoading: false,
  error: null,
  campaignsRows: null,
  selectedCount: 0,
  totalCount: 0,
  onSelectAll: vi.fn(),
  onDeselectAll: vi.fn(),
  page: 1,
  totalPages: 1,
  total: 0,
  onPageChange: vi.fn(),
};

describe('CampaignsTab — P52-C column headers', () => {
  it('renders Tags and Categories column headers', () => {
    render(<CampaignsTab {...defaultProps} />);
    expect(screen.getByText('Tags')).toBeInTheDocument();
    expect(screen.getByText('Categories')).toBeInTheDocument();
  });

  it('renders all expected column headers', () => {
    render(<CampaignsTab {...defaultProps} />);
    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Visibility')).toBeInTheDocument();
    expect(screen.getByText('Company')).toBeInTheDocument();
    expect(screen.getByText('Grants')).toBeInTheDocument();
    expect(screen.getByText('Tags')).toBeInTheDocument();
    expect(screen.getByText('Categories')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('renders Add Campaign button when onAddCampaign is provided', () => {
    const onAddCampaign = vi.fn();
    render(<CampaignsTab {...defaultProps} onAddCampaign={onAddCampaign} />);
    expect(screen.getByRole('button', { name: /add campaign/i })).toBeInTheDocument();
  });

  it('calls onAddCampaign when the button is clicked', () => {
    const onAddCampaign = vi.fn();
    render(<CampaignsTab {...defaultProps} onAddCampaign={onAddCampaign} />);
    fireEvent.click(screen.getByRole('button', { name: /add campaign/i }));
    expect(onAddCampaign).toHaveBeenCalledOnce();
  });

  it('does not render Add Campaign button when onAddCampaign is absent', () => {
    render(<CampaignsTab {...defaultProps} />);
    expect(screen.queryByRole('button', { name: /add campaign/i })).not.toBeInTheDocument();
  });

  it('renders campaign rows in the tbody', () => {
    const rows = <tr><td>My Campaign</td></tr>;
    render(<CampaignsTab {...defaultProps} campaignsRows={rows} />);
    expect(screen.getByText('My Campaign')).toBeInTheDocument();
  });
});
