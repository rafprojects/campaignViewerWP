import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@/test/test-utils';
import { CampaignsMobileList } from './CampaignsMobileList';
import type { AdminCampaign } from '@/services/adminQuery';
import type { CampaignActionsHandle } from '@/hooks/useAdminCampaignActions';

function makeCampaign(overrides: Partial<AdminCampaign> = {}): AdminCampaign {
  return {
    id: '1',
    title: 'Test Campaign',
    description: '',
    companyId: '',
    status: 'active',
    visibility: 'public',
    createdAt: '',
    updatedAt: '',
    tags: [],
    publishAt: '',
    unpublishAt: '',
    layoutTemplateId: '',
    categories: [],
    ...overrides,
  };
}

function makeCampaignActions(overrides: Partial<CampaignActionsHandle> = {}): CampaignActionsHandle {
  return {
    selectMode: false,
    selectedCampaignIds: new Set(),
    handleToggleCampaignSelect: vi.fn(),
    handleEdit: vi.fn(),
    setDuplicateSource: vi.fn(),
    handleExportCampaign: vi.fn().mockResolvedValue(undefined),
    setConfirmRestore: vi.fn(),
    setConfirmArchive: vi.fn(),
    setConfirmDelete: vi.fn(),
    restoringIds: new Set(),
    archivingIds: new Set(),
    deletingIds: new Set(),
    ...overrides,
  } as unknown as CampaignActionsHandle;
}

const defaultProps = {
  isLoading: false,
  error: null,
  campaigns: [makeCampaign()],
  campaignActions: makeCampaignActions(),
  page: 1,
  totalPages: 1,
  total: 1,
  onPageChange: vi.fn(),
};

describe('CampaignsMobileList — rendering', () => {
  it('shows loader when isLoading is true', () => {
    render(<CampaignsMobileList {...defaultProps} isLoading campaigns={[]} />);
    expect(document.querySelector('.mantine-Loader-root')).toBeTruthy();
  });

  it('shows error message when error is set', () => {
    render(<CampaignsMobileList {...defaultProps} error="Something went wrong" campaigns={[]} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
  });

  it('renders a card for each campaign', () => {
    const campaigns = [makeCampaign({ id: '1', title: 'Alpha' }), makeCampaign({ id: '2', title: 'Beta' })];
    render(<CampaignsMobileList {...defaultProps} campaigns={campaigns} total={2} />);
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('renders campaign description when present', () => {
    render(<CampaignsMobileList {...defaultProps} campaigns={[makeCampaign({ description: 'A nice campaign' })]} />);
    expect(screen.getByText('A nice campaign')).toBeInTheDocument();
  });

  it('renders status badge', () => {
    render(<CampaignsMobileList {...defaultProps} />);
    expect(screen.getByText('active')).toBeInTheDocument();
  });

  it('renders visibility badge', () => {
    render(<CampaignsMobileList {...defaultProps} />);
    expect(screen.getByText('public')).toBeInTheDocument();
  });

  it('renders Archive button for active campaign', () => {
    render(<CampaignsMobileList {...defaultProps} />);
    expect(screen.getByRole('button', { name: /archive/i })).toBeInTheDocument();
  });

  it('renders Restore button for archived campaign', () => {
    render(<CampaignsMobileList {...defaultProps} campaigns={[makeCampaign({ status: 'archived' })]} />);
    expect(screen.getByRole('button', { name: /restore/i })).toBeInTheDocument();
  });

  it('shows pagination when totalPages > 1', () => {
    render(<CampaignsMobileList {...defaultProps} totalPages={3} total={30} />);
    expect(screen.getByText('30 campaigns')).toBeInTheDocument();
  });

  it('does not show pagination when only one page', () => {
    render(<CampaignsMobileList {...defaultProps} totalPages={1} />);
    expect(screen.queryByText(/campaigns/)).not.toBeInTheDocument();
  });
});

describe('CampaignsMobileList — scheduled badges', () => {
  it('shows Scheduled badge for future publishAt', () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    render(<CampaignsMobileList {...defaultProps} campaigns={[makeCampaign({ publishAt: future })]} />);
    expect(screen.getByText('Scheduled')).toBeInTheDocument();
  });

  it('shows Expired badge for past unpublishAt', () => {
    const past = new Date(Date.now() - 86_400_000).toISOString();
    render(<CampaignsMobileList {...defaultProps} campaigns={[makeCampaign({ unpublishAt: past })]} />);
    expect(screen.getByText('Expired')).toBeInTheDocument();
  });

  it('shows Expiring soon badge when unpublishAt is within 24 hours', () => {
    const soon = new Date(Date.now() + 3_600_000).toISOString();
    render(<CampaignsMobileList {...defaultProps} campaigns={[makeCampaign({ unpublishAt: soon })]} />);
    expect(screen.getByText('Expiring soon')).toBeInTheDocument();
  });
});

describe('CampaignsMobileList — interactions', () => {
  it('calls handleEdit when Edit button clicked', () => {
    const handleEdit = vi.fn();
    render(<CampaignsMobileList {...defaultProps} campaignActions={makeCampaignActions({ handleEdit })} />);
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(handleEdit).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }));
  });

  it('calls setDuplicateSource when Clone button clicked', () => {
    const setDuplicateSource = vi.fn();
    render(<CampaignsMobileList {...defaultProps} campaignActions={makeCampaignActions({ setDuplicateSource })} />);
    fireEvent.click(screen.getByRole('button', { name: /duplicate/i }));
    expect(setDuplicateSource).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }));
  });

  it('calls setConfirmArchive when Archive button clicked', () => {
    const setConfirmArchive = vi.fn();
    render(<CampaignsMobileList {...defaultProps} campaignActions={makeCampaignActions({ setConfirmArchive })} />);
    fireEvent.click(screen.getByRole('button', { name: /archive/i }));
    expect(setConfirmArchive).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }));
  });

  it('calls setConfirmDelete when Delete button clicked', () => {
    const setConfirmDelete = vi.fn();
    render(<CampaignsMobileList {...defaultProps} campaignActions={makeCampaignActions({ setConfirmDelete })} />);
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    expect(setConfirmDelete).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }));
  });

  it('calls setConfirmRestore when Restore button clicked', () => {
    const setConfirmRestore = vi.fn();
    render(<CampaignsMobileList
      {...defaultProps}
      campaigns={[makeCampaign({ status: 'archived' })]}
      campaignActions={makeCampaignActions({ setConfirmRestore })}
    />);
    fireEvent.click(screen.getByRole('button', { name: /restore/i }));
    expect(setConfirmRestore).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }));
  });

  it('shows checkbox in selectMode', () => {
    render(<CampaignsMobileList {...defaultProps} campaignActions={makeCampaignActions({ selectMode: true })} />);
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });

  it('shows grant count tooltip badge when grantSummary provided', () => {
    const grantSummary = new Map([[1, { grantCount: 3, userId: 'u1' }]]);
    render(<CampaignsMobileList {...defaultProps} grantSummary={grantSummary as never} />);
    expect(screen.getByText(/3 grants/)).toBeInTheDocument();
  });
});
