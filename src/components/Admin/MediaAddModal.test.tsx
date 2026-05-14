import { describe, expect, it, beforeEach, vi } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen } from '@/test/test-utils';

const { modalPropsSpy } = vi.hoisted(() => ({
    modalPropsSpy: vi.fn(),
}));

vi.mock('@mantine/core', async () => {
    const actual = await vi.importActual<typeof import('@mantine/core')>('@mantine/core');

    return {
        ...actual,
        Modal: ({ children, withinPortal, opened }: { children: ReactNode; withinPortal?: boolean; opened: boolean }) => {
            modalPropsSpy({ withinPortal });
            return opened ? <div data-testid="media-add-modal-root">{children}</div> : null;
        },
    };
});

import { MediaAddModal } from './MediaAddModal';

describe('MediaAddModal', () => {
    beforeEach(() => {
        modalPropsSpy.mockReset();
    });

    it('keeps the media modal inside the active render tree', () => {
        render(
            <MediaAddModal
                opened={true}
                onClose={vi.fn()}
                dropRef={{ current: null }}
                selectedFile={null}
                onSelectFile={vi.fn()}
                previewUrl={null}
                uploadTitle=""
                onUploadTitleChange={vi.fn()}
                uploadCaption=""
                onUploadCaptionChange={vi.fn()}
                uploadProgress={null}
                uploading={false}
                onUpload={vi.fn()}
                externalUrl=""
                onExternalUrlChange={vi.fn()}
                externalError={null}
                onFetchOEmbed={vi.fn()}
                externalLoading={false}
                onAddExternal={vi.fn()}
                externalPreview={null}
            />,
        );

        expect(modalPropsSpy).toHaveBeenCalledWith(expect.objectContaining({ withinPortal: false }));
        expect(screen.getByText('Add External URL')).toBeInTheDocument();
    });
});