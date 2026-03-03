import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../test/test-utils';
import { CampaignImportModal } from './CampaignImportModal';

const defaults = {
  opened: true,
  isSaving: false,
  onImport: vi.fn(),
  onClose: vi.fn(),
};

// Helper: simulate FileButton selecting a file by triggering FileReader manually.
function simulateFileRead(content: string, type = 'application/json') {
  const originalFileReader = globalThis.FileReader;
  const mockReader = {
    readAsText: vi.fn(function (this: { onload: ((e: ProgressEvent) => void) | null }) {
      const event = { target: { result: content } } as unknown as ProgressEvent;
      this.onload?.(event);
    }),
    onload: null as ((e: ProgressEvent) => void) | null,
    onerror: null,
    result: content,
  };
  globalThis.FileReader = vi.fn(() => mockReader) as unknown as typeof FileReader;
  return {
    restore: () => { globalThis.FileReader = originalFileReader; },
    mockFile: new File([content], 'export.json', { type }),
  };
}

describe('CampaignImportModal', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('renders the modal with file picker', () => {
    render(<CampaignImportModal {...defaults} />);
    expect(screen.getByText('Import Campaign')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /select .json file/i })).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    render(<CampaignImportModal {...defaults} opened={false} />);
    expect(screen.queryByText('Import Campaign')).not.toBeInTheDocument();
  });

  it('Import button is disabled before a file is selected', () => {
    render(<CampaignImportModal {...defaults} />);
    expect(screen.getByRole('button', { name: /^import$/i })).toBeDisabled();
  });

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn();
    render(<CampaignImportModal {...defaults} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows parse error for invalid JSON', async () => {
    const { restore, mockFile } = simulateFileRead('{ bad json }');
    render(<CampaignImportModal {...defaults} />);
    // Find the hidden file <input> and dispatch change
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) {
      Object.defineProperty(fileInput, 'files', { value: [mockFile], configurable: true });
      fireEvent.change(fileInput);
    }
    await waitFor(() =>
      expect(screen.getByText(/could not parse json/i)).toBeInTheDocument(),
    );
    restore();
  });

  it('shows error for missing required keys', async () => {
    const { restore, mockFile } = simulateFileRead(JSON.stringify({ version: 1 }));
    render(<CampaignImportModal {...defaults} />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) {
      Object.defineProperty(fileInput, 'files', { value: [mockFile], configurable: true });
      fireEvent.change(fileInput);
    }
    await waitFor(() =>
      expect(screen.getByText(/missing version or campaign key/i)).toBeInTheDocument(),
    );
    restore();
  });

  it('shows error for unsupported version', async () => {
    const { restore, mockFile } = simulateFileRead(
      JSON.stringify({ version: 2, campaign: { title: 'Test' } }),
    );
    render(<CampaignImportModal {...defaults} />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) {
      Object.defineProperty(fileInput, 'files', { value: [mockFile], configurable: true });
      fireEvent.change(fileInput);
    }
    await waitFor(() =>
      expect(screen.getByText(/unsupported export version/i)).toBeInTheDocument(),
    );
    restore();
  });

  it('enables Import and shows campaign title for valid payload', async () => {
    const validPayload = { version: 1, campaign: { title: 'My Campaign' }, media_references: [] };
    const { restore, mockFile } = simulateFileRead(JSON.stringify(validPayload));
    render(<CampaignImportModal {...defaults} />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) {
      Object.defineProperty(fileInput, 'files', { value: [mockFile], configurable: true });
      fireEvent.change(fileInput);
    }
    await waitFor(() =>
      expect(screen.getByText(/ready to import/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(/my campaign/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^import$/i })).not.toBeDisabled();
    restore();
  });

  it('calls onImport with parsed payload when Import is clicked', async () => {
    const onImport = vi.fn();
    const validPayload = { version: 1, campaign: { title: 'My Campaign' }, media_references: [] };
    const { restore, mockFile } = simulateFileRead(JSON.stringify(validPayload));
    render(<CampaignImportModal {...defaults} onImport={onImport} />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) {
      Object.defineProperty(fileInput, 'files', { value: [mockFile], configurable: true });
      fireEvent.change(fileInput);
    }
    await waitFor(() => expect(screen.getByRole('button', { name: /^import$/i })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: /^import$/i }));
    expect(onImport).toHaveBeenCalledWith(validPayload);
    restore();
  });
});
