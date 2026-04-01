import type { RefObject } from 'react';

import { MediaAddModal } from '@/components/Admin/MediaAddModal';
import type { OEmbedResponse } from '@/types';

interface AddExternalMediaModalProps {
  opened: boolean;
  onClose: () => void;
  dropRef: RefObject<HTMLDivElement>;
  selectedFile: File | null;
  onSelectFile: (file: File | null) => void;
  previewUrl: string | null;
  uploadTitle: string;
  onUploadTitleChange: (value: string) => void;
  uploadCaption: string;
  onUploadCaptionChange: (value: string) => void;
  uploadProgress: number | null;
  uploading: boolean;
  onUpload: () => void;
  externalUrl: string;
  onExternalUrlChange: (value: string) => void;
  externalError: string | null;
  onFetchOEmbed: () => void;
  externalLoading: boolean;
  onAddExternal: () => void;
  externalPreview: OEmbedResponse | null;
}

export function AddExternalMediaModal(props: AddExternalMediaModalProps) {
  return <MediaAddModal {...props} title="Manage Media" zIndex={550} />;
}
