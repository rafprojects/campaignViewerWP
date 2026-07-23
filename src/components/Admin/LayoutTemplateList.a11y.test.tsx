import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '../../test/test-utils';
import { LayoutTemplateList } from './LayoutTemplateList';
import { expectNoA11yViolations } from '@/test/axe';

vi.mock('./LayoutBuilder/LayoutBuilderModal', () => ({
  LayoutBuilderModal: ({ opened }: { opened: boolean }) =>
    opened ? <div data-testid="layout-builder-modal" /> : null,
}));
vi.mock('./LayoutBuilder/PresetGalleryModal', () => ({
  PresetGalleryModal: () => <div data-testid="preset-gallery-modal" />,
}));
vi.mock('@/utils/wpsgUpsell', () => ({ showProUpsell: vi.fn() }));

const mockTemplate = {
  id: 'tpl-1',
  name: 'My Template',
  canvasAspectRatio: 16 / 9,
  slots: [{ id: 's1', x: 0, y: 0, width: 1, height: 1, mediaIndex: null, label: '' }],
  tags: [] as string[],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

function makeApiClient() {
  return {
    getLayoutTemplates: vi.fn().mockResolvedValue([mockTemplate]),
    deleteLayoutTemplate: vi.fn().mockResolvedValue({ deleted: true }),
    duplicateLayoutTemplate: vi.fn().mockResolvedValue({ ...mockTemplate, id: 'tpl-2' }),
    createLayoutTemplate: vi.fn().mockResolvedValue({ ...mockTemplate, id: 'tpl-new' }),
  } as any;
}

describe('LayoutTemplateList — a11y', () => {
  afterEach(() => vi.clearAllMocks());

  it('has no structural axe violations (grid view)', async () => {
    const { container } = render(<LayoutTemplateList apiClient={makeApiClient()} onNotify={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('My Template')).toBeInTheDocument());
    // Covers the toolbar (icon-only SegmentedControl segments — P72-G fix a) and
    // the grid card (nested-interactive Card/Menu — P72-G fix b).
    await expectNoA11yViolations(container);
  });

  it('has no structural axe violations (list view)', async () => {
    const { container } = render(<LayoutTemplateList apiClient={makeApiClient()} onNotify={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('My Template')).toBeInTheDocument());
    // Switch to the table/list view via the now-labelled segment.
    fireEvent.click(screen.getByRole('radio', { name: 'List view' }));
    await expectNoA11yViolations(container);
  });
});
