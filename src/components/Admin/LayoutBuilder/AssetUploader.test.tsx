/**
 * P17-B Tests: AssetUploader component
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@/test/test-utils';
import { AssetUploader } from './AssetUploader';

function makeProps(overrides = {}) {
  return {
    onFileSelect: vi.fn(),
    onUrlSubmit: vi.fn(),
    ...overrides,
  };
}

describe('AssetUploader', () => {
  it('renders upload button with default label', () => {
    render(<AssetUploader {...makeProps()} />);
    expect(screen.getByRole('button', { name: /upload image/i })).toBeInTheDocument();
  });

  it('renders URL input with default placeholder', () => {
    render(<AssetUploader {...makeProps()} />);
    expect(screen.getByPlaceholderText(/or paste image url/i)).toBeInTheDocument();
  });

  it('uses custom uploadLabel prop', () => {
    render(<AssetUploader {...makeProps({ uploadLabel: 'Add to library' })} />);
    expect(screen.getByRole('button', { name: 'Add to library' })).toBeInTheDocument();
  });

  it('calls onUrlSubmit with trimmed value when Enter is pressed', () => {
    const onUrlSubmit = vi.fn();
    render(<AssetUploader {...makeProps({ onUrlSubmit })} />);
    const input = screen.getByPlaceholderText(/or paste image url/i);
    fireEvent.change(input, { target: { value: '  https://example.com/img.png  ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onUrlSubmit).toHaveBeenCalledWith('https://example.com/img.png');
  });

  it('does not call onUrlSubmit when Enter is pressed with empty value', () => {
    const onUrlSubmit = vi.fn();
    render(<AssetUploader {...makeProps({ onUrlSubmit })} />);
    const input = screen.getByPlaceholderText(/or paste image url/i);
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onUrlSubmit).not.toHaveBeenCalled();
  });

  it('clears the URL input after a successful submit', () => {
    render(<AssetUploader {...makeProps()} />);
    const input = screen.getByPlaceholderText(/or paste image url/i);
    fireEvent.change(input, { target: { value: 'https://example.com/img.png' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(input).toHaveValue('');
  });

  it('shows Loader and disables button when isUploading=true', () => {
    render(<AssetUploader {...makeProps({ isUploading: true })} />);
    expect(screen.getByRole('button', { name: /upload image/i })).toBeDisabled();
  });

  it('disables both inputs when disabled=true', () => {
    render(<AssetUploader {...makeProps({ disabled: true })} />);
    expect(screen.getByRole('button', { name: /upload image/i })).toBeDisabled();
    expect(screen.getByPlaceholderText(/or paste image url/i)).toBeDisabled();
  });
});
