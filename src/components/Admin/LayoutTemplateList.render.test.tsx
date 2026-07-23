/**
 * Branch-coverage for LayoutTemplateList render/effect paths: the
 * initialTemplateId deep-link, card keyboard activation, and the slot-shape
 * border-radius ternary.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../test/test-utils';
import { LayoutTemplateList } from './LayoutTemplateList';

vi.mock('./LayoutBuilder/LayoutBuilderModal', () => ({
  LayoutBuilderModal: ({ opened }: { opened: boolean }) =>
    opened ? <div data-testid="layout-builder-modal" /> : null,
}));
vi.mock('./LayoutBuilder/PresetGalleryModal', () => ({ PresetGalleryModal: () => null }));

const tpl = (id: string, name: string, shape: 'rectangle' | 'circle' = 'rectangle') => ({
  id, name, canvasAspectRatio: 16 / 9,
  slots: [{ id: 's1', x: 0, y: 0, width: 50, height: 50, zIndex: 1, shape, borderRadius: 8,
    borderWidth: 0, borderColor: '#fff', objectFit: 'cover', objectPosition: '50% 50%',
    clickAction: 'lightbox', hoverEffect: 'pop' }],
  tags: [] as string[], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z',
});

function makeApiClient(templates: unknown[]) {
  return {
    getLayoutTemplates: vi.fn().mockResolvedValue(templates),
    deleteLayoutTemplate: vi.fn(),
    duplicateLayoutTemplate: vi.fn(),
    createLayoutTemplate: vi.fn(),
     
  } as any;
}

describe('LayoutTemplateList render/effect branches', () => {
  it('opens the builder for a deep-linked initialTemplateId', async () => {
    const apiClient = makeApiClient([tpl('t1', 'Deep')]);
    render(<LayoutTemplateList apiClient={apiClient} onNotify={vi.fn()} initialTemplateId="t1" />);
    expect(await screen.findByTestId('layout-builder-modal')).toBeInTheDocument();
  });

  it('renders a non-rectangle slot (shape ternary) and activates a card', async () => {
    const apiClient = makeApiClient([tpl('t1', 'CircleCard', 'circle')]);
    render(<LayoutTemplateList apiClient={apiClient} onNotify={vi.fn()} />);
    // P72-G: the primary edit action is now a real <button> (UnstyledButton),
    // which activates on click (and, in a real browser, Enter/Space natively) —
    // no longer a role="button" div with a manual onKeyDown.
    const card = await screen.findByLabelText('Edit layout CircleCard');
    fireEvent.click(card);
    expect(await screen.findByTestId('layout-builder-modal')).toBeInTheDocument();
  });

  it('renders the empty state with no templates', async () => {
    const apiClient = makeApiClient([]);
    render(<LayoutTemplateList apiClient={apiClient} onNotify={vi.fn()} />);
    await waitFor(() => expect(apiClient.getLayoutTemplates).toHaveBeenCalled());
    expect(screen.queryByLabelText(/Edit layout/)).toBeNull();
  });
});
