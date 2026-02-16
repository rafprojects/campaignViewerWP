import { useCallback, useState } from 'react';

interface UploadParams {
  url: string;
  file: File;
  headers?: Record<string, string>;
  fileFieldName?: string;
  extraFields?: Record<string, string>;
}

export function useXhrUpload() {
  const [progress, setProgress] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const resetProgress = useCallback(() => {
    setProgress(null);
  }, []);

  const upload = useCallback(async <T,>({
    url,
    file,
    headers,
    fileFieldName = 'file',
    extraFields,
  }: UploadParams): Promise<T> => {
    setIsUploading(true);
    setProgress(0);

    try {
      const formData = new FormData();
      formData.append(fileFieldName, file);
      if (extraFields) {
        Object.entries(extraFields).forEach(([key, value]) => {
          formData.append(key, value);
        });
      }

      const response = await new Promise<T>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', url);

        if (headers) {
          Object.entries(headers).forEach(([key, value]) => {
            xhr.setRequestHeader(key, value);
          });
        }

        const onProgress = (event: ProgressEvent) => {
          if (event.lengthComputable) {
            setProgress(Math.round((event.loaded / event.total) * 100));
          }
        };

        if (typeof xhr.upload?.addEventListener === 'function') {
          xhr.upload.addEventListener('progress', onProgress);
        } else if (xhr.upload) {
          xhr.upload.onprogress = onProgress;
        }

        const handleLoad = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              if (xhr.response && typeof xhr.response === 'object') {
                resolve(xhr.response as T);
                return;
              }

              const raw = typeof xhr.responseText === 'string' ? xhr.responseText : '';
              resolve(JSON.parse(raw) as T);
            } catch {
              reject(new Error('Invalid upload response.'));
            }
            return;
          }

          // Try to extract a server message from the response body
          let serverMessage = '';
          try {
            const body = xhr.response && typeof xhr.response === 'object'
              ? xhr.response
              : JSON.parse(xhr.responseText || '{}');
            serverMessage = body?.message || '';
          } catch { /* ignore parse errors */ }

          // Map common HTTP status codes to user-friendly messages
          const friendlyMessages: Record<number, string> = {
            401: 'Not authorized. Please sign in again.',
            403: 'Permission denied.',
            413: 'File too large for the server to accept.',
            415: 'File type not accepted by the server.',
            500: 'Server error during upload. Please try again.',
          };
          const friendly = friendlyMessages[xhr.status];
          reject(new Error(serverMessage || friendly || `Upload failed (status ${xhr.status}).`));
        };

        const handleError = () => {
          reject(new Error('Upload failed.'));
        };

        if (typeof xhr.addEventListener === 'function') {
          xhr.addEventListener('load', handleLoad);
          xhr.addEventListener('error', handleError);
        } else {
          xhr.onload = handleLoad;
          xhr.onerror = handleError;
        }

        xhr.send(formData);
      });

      return response;
    } finally {
      setIsUploading(false);
    }
  }, []);

  return { upload, progress, isUploading, resetProgress };
}