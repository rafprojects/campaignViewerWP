/**
 * Branch-coverage tests for LayoutTemplateList (hand-authored). Targets the
 * aspect-ratio/date helpers (rendered for varied ratios), the delete 409
 * force-confirm escalation, and the duplicate error path.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../test/test-utils';
import { LayoutTemplateList } from './LayoutTemplateList';
import { ApiError } from '@/services/apiClient';

vi.mock('./LayoutBuilder/LayoutBuilderModal', () => ({
  LayoutBuilderModal: ({ opened, onClose }: { opened: boolean; onClose: () => void }) =>
    opened ? <div data-testid="layout-builder-modal"><button onClick={onClose}>Close Builder</button></div> : null,
}));
vi.mock('./LayoutBuilder/PresetGalleryModal', () => ({ PresetGalleryModal: () => null }));

const tpl = (id: string, name: string, ratio: number, updatedAt = '2026-01-02T00:00:00.000Z') => ({
  id, name, canvasAspectRatio: ratio,
  slots: [{ id: 's1', x: 0, y: 0, width: 1, height: 1, mediaIndex: null, label: '' }],
  tags: [] as string[], createdAt: '2026-01-01T00:00:00.000Z', updatedAt,
});

function makeApiClient(overrides: Record<string, unknown> = {}) {
  return {
    getLayoutTemplates: vi.fn().mockResolvedValue([tpl('t1', 'Tpl', 16 / 9)]),
    deleteLayoutTemplate: vi.fn().mockResolvedValue({ deleted: true }),
    duplicateLayoutTemplate: vi.fn().mockResolvedValue(tpl('t2', 'copy', 1)),
    createLayoutTemplate: vi.fn(),
     
    ...overrides,
  } as any;
}

describe('aspect-ratio + date helpers via render', () => {
  it('formats each known aspect ratio and a fallback, plus an empty date', async () => {
    const apiClient = makeApiClient({
      getLayoutTemplates: vi.fn().mockResolvedValue([
        tpl('a', 'FourThree', 4 / 3),
        tpl('b', 'Square', 1),
        tpl('c', 'Ultrawide', 21 / 9),
        tpl('d', 'ThreeTwo', 3 / 2),
        tpl('e', 'Weird', 2.71, ''),
      ]),
    });
    render(<LayoutTemplateList apiClient={apiClient} onNotify={vi.fn()} />);
    expect(await screen.findByText('FourThree')).toBeInTheDocument();
    expect(screen.getByText('4:3')).toBeInTheDocument();
    expect(screen.getByText('1:1')).toBeInTheDocument();
    expect(screen.getByText('21:9')).toBeInTheDocument();
    expect(screen.getByText('3:2')).toBeInTheDocument();
    expect(screen.getByText('2.71')).toBeInTheDocument();
  });
});

describe('delete escalation + duplicate error', () => {
  it('escalates a 409 in-use delete to a force-confirm', async () => {
    const onNotify = vi.fn();
    const deleteLayoutTemplate = vi
      .fn()
      .mockRejectedValueOnce(new ApiError('in use', 409, { data: { inUse: 2 } }))
      .mockResolvedValueOnce({ deleted: true });
    const apiClient = makeApiClient({
      getLayoutTemplates: vi.fn().mockResolvedValue([tpl('t1', 'DelMe', 16 / 9)]),
      deleteLayoutTemplate,
    });
    render(<LayoutTemplateList apiClient={apiClient} onNotify={onNotify} />);
    await screen.findByText('DelMe');

    // open the row menu and click Delete
    const menuButtons = screen.getAllByLabelText(/template actions|actions/i);
    fireEvent.click(menuButtons[0]!);
    fireEvent.click(await screen.findByText('Delete'));
    // first confirm
    fireEvent.click(await screen.findByRole('button', { name: /^Delete$/ }));

    // 409 → second "Delete anyway" confirm appears
    const forceBtn = await screen.findByRole('button', { name: /Delete anyway/i });
    fireEvent.click(forceBtn);
    await waitFor(() => expect(deleteLayoutTemplate).toHaveBeenCalledTimes(2));
    expect(deleteLayoutTemplate).toHaveBeenLastCalledWith('t1', true);
  });

  it('notifies when duplicate fails', async () => {
    const onNotify = vi.fn();
    const apiClient = makeApiClient({
      getLayoutTemplates: vi.fn().mockResolvedValue([tpl('t1', 'DupMe', 16 / 9)]),
      duplicateLayoutTemplate: vi.fn().mockRejectedValue(new Error('dup failed')),
    });
    render(<LayoutTemplateList apiClient={apiClient} onNotify={onNotify} />);
    await screen.findByText('DupMe');
    const menuButtons = screen.getAllByLabelText(/template actions|actions/i);
    fireEvent.click(menuButtons[0]!);
    fireEvent.click(await screen.findByText('Duplicate'));
    await waitFor(() => expect(onNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' })));
  });
});
