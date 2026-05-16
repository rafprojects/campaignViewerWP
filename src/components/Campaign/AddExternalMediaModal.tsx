import type { RefObject } from 'react';

import { MediaAddModal } from '@/components/Admin/MediaAddModal';
import type { OEmbedResponse } from '@/types';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

interface AddExternalMediaModalProps {
  opened: boolean;
  onClose: () => void;
  dropRef: RefObject<HTMLDivElement | null>;
  selectedFiles: File[];
  onSelectFiles: (files: File[]) => void;
  previewUrl: string | null;
  uploadTitle: string;
  onUploadTitleChange: (value: string) => void;
  uploadCaption: string;
  onUploadCaptionChange: (value: string) => void;
  uploadProgresses: number[] | null;
  uploadErrors?: Array<string | null>;
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

setWpsgDebugDisplayName(AddExternalMediaModal, 'AddExternalMediaModal');