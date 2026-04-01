import { describe, expect, it, vi } from 'vitest';

import { render } from '@/test/test-utils';

let capturedProps: Record<string, unknown> | undefined;

vi.mock('@/components/Admin/MediaAddModal', () => ({
  MediaAddModal: (props: Record<string, unknown>) => {
    capturedProps = props;
    return <div data-testid="media-add-modal-proxy" />;
  },
}));

import { AddExternalMediaModal } from './AddExternalMediaModal';

describe('AddExternalMediaModal', () => {
  it('raises the shared manage media modal above the campaign viewer stack', () => {
    capturedProps = undefined;

    render(
      <AddExternalMediaModal
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

    expect(capturedProps).toEqual(expect.objectContaining({
      title: 'Manage Media',
      zIndex: 550,
    }));
  });
});