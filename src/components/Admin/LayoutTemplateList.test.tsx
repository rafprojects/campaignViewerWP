import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../test/test-utils';
import { LayoutTemplateList } from './LayoutTemplateList';

// Stub heavy LayoutBuilder modal to keep tests fast
vi.mock('./LayoutBuilder', () => ({
  LayoutBuilderModal: ({ opened, onClose }: { opened: boolean; onClose: () => void }) =>
    opened ? <div data-testid="layout-builder-modal"><button onClick={onClose}>Close Builder</button></div> : null,
  PresetGalleryModal: () => null,
}));

vi.mock('./LayoutBuilder/PresetGalleryModal', () => ({
  PresetGalleryModal: () => null,
}));

const mockTemplate = {
  id: 'tpl-1',
  name: 'My Template',
  canvasAspectRatio: 16 / 9,
  slots: [{ id: 's1', x: 0, y: 0, width: 1, height: 1, mediaIndex: null, label: '' }],
  tags: [] as string[],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

function makeApiClient(overrides: Record<string, unknown> = {}) {
  return {
    getLayoutTemplates: vi.fn().mockResolvedValue([mockTemplate]),
    deleteLayoutTemplate: vi.fn().mockResolvedValue({ deleted: true }),
    duplicateLayoutTemplate: vi.fn().mockResolvedValue({ ...mockTemplate, id: 'tpl-2', name: 'My Template (copy)' }),
    createLayoutTemplate: vi.fn().mockResolvedValue({ ...mockTemplate, id: 'tpl-new' }),
    ...overrides,
  } as any;
}

describe('LayoutTemplateList', () => {
  it('renders loading skeletons then template list', async () => {
    const apiClient = makeApiClient();
    render(<LayoutTemplateList apiClient={apiClient} onNotify={vi.fn()} />);
    // Wait for templates to load
    expect(await screen.findByText('My Template')).toBeInTheDocument();
    expect(apiClient.getLayoutTemplates).toHaveBeenCalled();
  });

  it('filters templates by search query', async () => {
    const apiClient = makeApiClient({
      getLayoutTemplates: vi.fn().mockResolvedValue([
        mockTemplate,
        { ...mockTemplate, id: 'tpl-other', name: 'Other Template' },
      ]),
    });
    render(<LayoutTemplateList apiClient={apiClient} onNotify={vi.fn()} />);
    await screen.findByText('My Template');

    fireEvent.change(screen.getByPlaceholderText(/search/i), {
      target: { value: 'Other' },
    });
    expect(screen.getByText('Other Template')).toBeInTheDocument();
    expect(screen.queryByText('My Template')).not.toBeInTheDocument();
  });

  it('switches between grid and list view', async () => {
    // Mantine SegmentedControl uses icon-only labels; query radio inputs by value attribute
    const { container } = render(<LayoutTemplateList apiClient={makeApiClient()} onNotify={vi.fn()} />);
    await screen.findByText('My Template');

    const listOption = container.querySelector<HTMLInputElement>('input[value="list"]')!;
    expect(listOption).not.toBeNull();
    fireEvent.click(listOption);

    // And back to grid — SegmentedControl uses icon-only labels, query by value
    const gridOption = container.querySelector<HTMLInputElement>('input[value="grid"]')!;
    fireEvent.click(gridOption);
    expect(screen.getByText('My Template')).toBeInTheDocument();
  });

  it('duplicates a template and notifies', async () => {
    const apiClient = makeApiClient();
    const onNotify = vi.fn();
    render(<LayoutTemplateList apiClient={apiClient} onNotify={onNotify} />);
    await screen.findByText('My Template');

    // Open card actions menu
    const menuBtn = screen.getByRole('button', { name: /actions/i });
    fireEvent.click(menuBtn);

    const duplicateBtn = await screen.findByRole('menuitem', { name: /duplicate/i });
    fireEvent.click(duplicateBtn);

    await waitFor(() => {
      expect(apiClient.duplicateLayoutTemplate).toHaveBeenCalledWith('tpl-1', 'My Template (copy)');
    });
    await waitFor(() => {
      expect(onNotify).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'success' }),
      );
    });
  });

  it('opens delete confirm modal and confirms deletion', async () => {
    const apiClient = makeApiClient();
    const onNotify = vi.fn();
    render(<LayoutTemplateList apiClient={apiClient} onNotify={onNotify} />);
    await screen.findByText('My Template');

    const menuBtn = screen.getByRole('button', { name: /actions/i });
    fireEvent.click(menuBtn);

    const deleteBtn = await screen.findByRole('menuitem', { name: /delete/i });
    fireEvent.click(deleteBtn);

    // Confirm modal appears
    const confirmBtn = await screen.findByRole('button', { name: 'Delete' });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(apiClient.deleteLayoutTemplate).toHaveBeenCalledWith('tpl-1');
    });
    await waitFor(() => {
      expect(onNotify).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'success' }),
      );
    });
  });

  it('opens the layout builder when Edit is clicked', async () => {
    const apiClient = makeApiClient();
    render(<LayoutTemplateList apiClient={apiClient} onNotify={vi.fn()} />);
    await screen.findByText('My Template');

    const menuBtn = screen.getByRole('button', { name: /actions/i });
    fireEvent.click(menuBtn);

    const editBtn = await screen.findByRole('menuitem', { name: /edit/i });
    fireEvent.click(editBtn);

    expect(await screen.findByTestId('layout-builder-modal')).toBeInTheDocument();
  });

  it('shows empty state when search has no match', async () => {
    const apiClient = makeApiClient();
    render(<LayoutTemplateList apiClient={apiClient} onNotify={vi.fn()} />);
    await screen.findByText('My Template');

    fireEvent.change(screen.getByPlaceholderText(/search/i), {
      target: { value: 'zzznomatch' },
    });
    expect(screen.getByText(/No layouts match your search/i)).toBeInTheDocument();
  });
});
