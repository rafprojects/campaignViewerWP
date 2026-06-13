import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@/test/test-utils';
import { MediaAddModal } from './MediaAddModal';

const defaults = {
  opened: true,
  onClose: vi.fn(),
  dropRef: { current: null } as React.RefObject<HTMLDivElement | null>,
  selectedFiles: [] as File[],
  onSelectFiles: vi.fn(),
  previewUrl: null,
  uploadTitle: '',
  onUploadTitleChange: vi.fn(),
  uploadCaption: '',
  onUploadCaptionChange: vi.fn(),
  uploadProgresses: null,
  uploading: false,
  onUpload: vi.fn(),
  externalUrl: '',
  onExternalUrlChange: vi.fn(),
  externalError: null,
  onFetchOEmbed: vi.fn(),
  externalLoading: false,
  onAddExternal: vi.fn(),
  externalPreview: null,
};

/** Returns a mutable ref that React will populate with the Paper element after render. */
function makeMutableDropRef() {
  return { current: null as HTMLDivElement | null };
}

describe('MediaAddModal', () => {
  it('keeps the media modal inside the active render tree', () => {
    const { container } = render(<MediaAddModal {...defaults} />);
    const content = screen.getByText('Add External URL');
    expect(container).toContainElement(content);
  });

  it('shows default hint text when not dragging', () => {
    render(<MediaAddModal {...defaults} />);
    expect(screen.getByText(/or drag & drop files here/i)).toBeInTheDocument();
  });

  it('shows drag-over hint on dragenter', async () => {
    const dropRef = makeMutableDropRef();
    render(<MediaAddModal {...defaults} dropRef={dropRef} />);
    // After render, dropRef.current is the Paper element (set by the ref prop).
    const el = dropRef.current!;

    await act(async () => { fireEvent.dragEnter(el); });

    expect(screen.getByText('Drop files here')).toBeInTheDocument();
  });

  it('restores default hint after dragleave', async () => {
    const dropRef = makeMutableDropRef();
    render(<MediaAddModal {...defaults} dropRef={dropRef} />);
    const el = dropRef.current!;

    await act(async () => { fireEvent.dragEnter(el); });
    expect(screen.getByText('Drop files here')).toBeInTheDocument();

    await act(async () => { fireEvent.dragLeave(el); });
    expect(screen.getByText(/or drag & drop files here/i)).toBeInTheDocument();
  });

  it('restores default hint after drop', async () => {
    const dropRef = makeMutableDropRef();
    render(<MediaAddModal {...defaults} dropRef={dropRef} />);
    const el = dropRef.current!;

    await act(async () => { fireEvent.dragEnter(el); });
    expect(screen.getByText('Drop files here')).toBeInTheDocument();

    await act(async () => { fireEvent.drop(el); });
    expect(screen.getByText(/or drag & drop files here/i)).toBeInTheDocument();
  });

  it('calls onSelectFiles with dropped files', async () => {
    const onSelectFiles = vi.fn();
    const dropRef = makeMutableDropRef();
    render(<MediaAddModal {...defaults} dropRef={dropRef} onSelectFiles={onSelectFiles} />);
    const el = dropRef.current!;

    const file = new File([''], 'photo.jpg', { type: 'image/jpeg' });
    await act(async () => {
      fireEvent.drop(el, { dataTransfer: { files: [file] } });
    });

    expect(onSelectFiles).toHaveBeenCalledWith([file]);
  });

  it('hides the "Add to" selector when no targetOptions are provided', () => {
    render(<MediaAddModal {...defaults} />);
    expect(screen.queryByRole('combobox', { name: 'Add to' })).toBeNull();
  });

  it('shows the "Add to" selector when targetOptions are provided', () => {
    render(
      <MediaAddModal
        {...defaults}
        targetOptions={[{ value: '__general__', label: 'General library' }, { value: '1', label: 'Campaign One' }]}
        targetValue="__general__"
        onTargetChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('combobox', { name: 'Add to' })).toBeInTheDocument();
  });

  it('does not register listeners when modal is closed', async () => {
    const onSelectFiles = vi.fn();
    const dropRef = makeMutableDropRef();
    render(<MediaAddModal {...defaults} opened={false} dropRef={dropRef} onSelectFiles={onSelectFiles} />);
    // dropRef.current may be null since Modal doesn't render children when closed
    const el = dropRef.current;
    if (el) {
      await act(async () => { fireEvent.drop(el, { dataTransfer: { files: [new File([''], 'x.jpg')] } }); });
      expect(onSelectFiles).not.toHaveBeenCalled();
    }
    // If el is null (modal not rendered), the test passes implicitly — listeners cannot attach
    expect(el).toBeNull();
  });
});