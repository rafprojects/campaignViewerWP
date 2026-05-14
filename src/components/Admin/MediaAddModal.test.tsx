import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@/test/test-utils';
import { MediaAddModal } from './MediaAddModal';

describe('MediaAddModal', () => {
    it('keeps the media modal inside the active render tree', () => {
        const { container } = render(
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

        // With withinPortal={false}, the modal content renders inside our
        // component tree rather than being portaled to document.body.
        const content = screen.getByText('Add External URL');
        expect(container).toContainElement(content);
    });
});