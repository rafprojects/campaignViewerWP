import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../../test/test-utils';
import { CampaignMoveSpaceModal } from './CampaignMoveSpaceModal';
import type { AdminCampaign, SpaceInfo } from '@/services/adminQuery';

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

const makeSpace = (id: number, name: string, overrides: Partial<SpaceInfo> = {}): SpaceInfo => ({
  id,
  slug: name.toLowerCase().replace(/\s+/g, '-'),
  name,
  isolationMode: 'open',
  isDefault: id === 1,
  archived: false,
  grantCount: 0,
  effectiveLevel: 'owner',
  createdAt: '',
  updatedAt: '',
  ...overrides,
});

const spaceA = makeSpace(1, 'Space A');
const spaceB = makeSpace(2, 'Space B');
const spaceArchived = makeSpace(3, 'Space Archived', { archived: true });
const spaceEditorOnly = makeSpace(4, 'Space Editor Only', { effectiveLevel: 'editor' });

const defaults = {
  source: mockSource,
  sourceSpace: spaceA,
  spaces: [spaceA, spaceB, spaceArchived, spaceEditorOnly],
  isSaving: false,
  onConfirm: vi.fn(),
  onClose: vi.fn(),
};

describe('CampaignMoveSpaceModal', () => {
  it('renders nothing when source is null', () => {
    render(<CampaignMoveSpaceModal {...defaults} source={null} />);
    expect(screen.queryByText('Move Campaign to Space')).not.toBeInTheDocument();
  });

  it('shows the campaign title and source space name', () => {
    render(<CampaignMoveSpaceModal {...defaults} />);
    expect(screen.getByText('Move Campaign to Space')).toBeInTheDocument();
    expect(screen.getByText('Summer Campaign')).toBeInTheDocument();
    expect(screen.getByText('Space A')).toBeInTheDocument();
  });

  it('offers only active owned spaces other than the source as targets', () => {
    render(<CampaignMoveSpaceModal {...defaults} />);
    fireEvent.click(screen.getByRole('combobox', { name: 'Target space' }));
    expect(screen.getByRole('option', { name: 'Space B' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Space A' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Space Archived' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Space Editor Only' })).not.toBeInTheDocument();
  });

  it('Move button is disabled until a target is selected', () => {
    render(<CampaignMoveSpaceModal {...defaults} />);
    expect(screen.getByRole('button', { name: /move/i })).toBeDisabled();
  });

  it('calls onConfirm with the selected space id and name', () => {
    const onConfirm = vi.fn();
    render(<CampaignMoveSpaceModal {...defaults} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole('combobox', { name: 'Target space' }));
    fireEvent.click(screen.getByRole('option', { name: 'Space B' }));
    fireEvent.click(screen.getByRole('button', { name: /move/i }));
    expect(onConfirm).toHaveBeenCalledWith(2, 'Space B');
  });

  it('mentions what moves with the campaign', () => {
    render(<CampaignMoveSpaceModal {...defaults} />);
    expect(screen.getByText(/analytics, audit history, media references, and access requests/i)).toBeInTheDocument();
  });

  it('disables the select when no other owned space exists', () => {
    render(<CampaignMoveSpaceModal {...defaults} spaces={[spaceA, spaceEditorOnly]} />);
    expect(screen.getByRole('combobox', { name: 'Target space' })).toBeDisabled();
  });

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn();
    render(<CampaignMoveSpaceModal {...defaults} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows loading state on the Move button while saving', () => {
    render(<CampaignMoveSpaceModal {...defaults} isSaving={true} />);
    expect(screen.getByRole('button', { name: /move/i })).toHaveAttribute('data-loading', 'true');
  });
});
