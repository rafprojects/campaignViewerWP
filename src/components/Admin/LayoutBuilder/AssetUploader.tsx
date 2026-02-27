/**
 * P17-B — AssetUploader
 *
 * Reusable upload+URL sub-component shared by the Graphic Layers library
 * section and the Background image section inside the Design Assets accordion.
 *
 * Renders a FileButton (for file upload) and a TextInput (for pasting a URL).
 * The parent supplies the handlers and loading state; this component owns
 * only the TextInput's own ephemeral value so it can clear itself after submit.
 */
import { useRef, useState } from 'react';
import {
  Button,
  FileButton,
  Loader,
  Stack,
  TextInput,
} from '@mantine/core';
import { IconUpload } from '@tabler/icons-react';

export interface AssetUploaderProps {
  /** Called when the user picks a file via the file dialog. */
  onFileSelect: (file: File) => void;
  /** Called when the user presses Enter in the URL input with a non-empty value. */
  onUrlSubmit: (url: string) => void;
  /** When true, disables both inputs and shows a spinner in the upload button. */
  isUploading?: boolean;
  /** Optional extra disabled flag (e.g., during a parent-level save). */
  disabled?: boolean;
  /** MIME type filter for the file picker. Defaults to "image/*". */
  accept?: string;
  /** Label printed inside the upload button. Defaults to "Upload image". */
  uploadLabel?: string;
  /** Placeholder text for the URL input. */
  urlPlaceholder?: string;
  /** aria-label for the upload button. */
  uploadAriaLabel?: string;
  /** aria-label for the URL text input. */
  urlAriaLabel?: string;
}

export function AssetUploader({
  onFileSelect,
  onUrlSubmit,
  isUploading = false,
  disabled = false,
  accept = 'image/*',
  uploadLabel = 'Upload image',
  urlPlaceholder = 'Or paste image URL…',
  uploadAriaLabel,
  urlAriaLabel = 'Image URL',
}: AssetUploaderProps) {
  const [urlValue, setUrlValue] = useState('');
  // FileButton needs a reset ref to clear the native input after each pick
  // so the same file can be re-selected without the change event being swallowed.
  const resetRef = useRef<() => void>(null);

  const isDisabled = isUploading || disabled;

  function handleUrlKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      const trimmed = urlValue.trim();
      if (trimmed) {
        onUrlSubmit(trimmed);
        setUrlValue('');
      }
    }
  }

  function handleFileChange(file: File | null) {
    if (file) {
      onFileSelect(file);
      resetRef.current?.();
    }
  }

  return (
    <Stack gap={4}>
      <FileButton
        accept={accept}
        onChange={handleFileChange}
        disabled={isDisabled}
        resetRef={resetRef}
      >
        {(props) => (
          <Button
            size="xs"
            variant="light"
            fullWidth
            leftSection={
              isUploading ? <Loader size={10} /> : <IconUpload size={12} />
            }
            disabled={isDisabled}
            aria-label={uploadAriaLabel ?? uploadLabel}
            {...props}
          >
            {uploadLabel}
          </Button>
        )}
      </FileButton>

      <TextInput
        size="xs"
        placeholder={urlPlaceholder}
        value={urlValue}
        onChange={(e) => setUrlValue(e.currentTarget.value)}
        onKeyDown={handleUrlKeyDown}
        disabled={isDisabled}
        aria-label={urlAriaLabel}
      />
    </Stack>
  );
}
