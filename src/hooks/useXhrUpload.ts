import { useCallback, useEffect, useRef, useState } from 'react';

interface UploadParams {
  url: string;
  file: File;
  headers?: Record<string, string>;
  fileFieldName?: string;
  extraFields?: Record<string, string>;
}

interface UploadManyParams {
  url: string;
  files: File[];
  headers?: Record<string, string>;
  fileFieldName?: string;
  extraFields?: Record<string, string>;
}

export function useXhrUpload() {
  const [progress, setProgress] = useState<number | null>(null);
  const [batchProgress, setBatchProgress] = useState<number[] | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const resetProgress = useCallback(() => {
    setProgress(null);
    setBatchProgress(null);
  }, []);

  // Abort in-flight upload on unmount
  useEffect(() => {
    return () => {
      if (xhrRef.current) {
        xhrRef.current.abort();
        xhrRef.current = null;
      }
    };
  }, []);

  const abort = useCallback(() => {
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
      setIsUploading(false);
      setProgress(null);
      setBatchProgress(null);
    }
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
    setBatchProgress(null);

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
        xhrRef.current = xhr;
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
      xhrRef.current = null;
      setIsUploading(false);
    }
  }, []);

  const uploadMany = useCallback(async <T,>({
    url,
    files,
    headers,
    fileFieldName = 'files[]',
    extraFields,
  }: UploadManyParams): Promise<T> => {
    if (files.length === 0) {
      throw new Error('No files selected for upload.');
    }

    setIsUploading(true);
    setProgress(null);
    setBatchProgress(Array(files.length).fill(0));

    try {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append(fileFieldName, file);
      });
      if (extraFields) {
        Object.entries(extraFields).forEach(([key, value]) => {
          formData.append(key, value);
        });
      }

      const fileSizes = files.map((file) => Math.max(file.size, 1));
      const cumulativeSizes = fileSizes.reduce<number[]>((totals, size, index) => {
        const previous = index === 0 ? 0 : totals[index - 1] ?? 0;
        totals.push(previous + size);
        return totals;
      }, []);

      const response = await new Promise<T>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;
        xhr.open('POST', url);

        if (headers) {
          Object.entries(headers).forEach(([key, value]) => {
            xhr.setRequestHeader(key, value);
          });
        }

        const onProgress = (event: ProgressEvent) => {
          if (!event.lengthComputable) {
            return;
          }

          const loaded = event.loaded;
          const perFileProgress = files.map((_file, index) => {
            const previousTotal = index === 0 ? 0 : cumulativeSizes[index - 1] ?? 0;
            const loadedForFile = Math.min(Math.max(loaded - previousTotal, 0), fileSizes[index] ?? 1);
            return Math.round((loadedForFile / (fileSizes[index] ?? 1)) * 100);
          });

          setBatchProgress(perFileProgress);
        };

        if (typeof xhr.upload?.addEventListener === 'function') {
          xhr.upload.addEventListener('progress', onProgress);
        } else if (xhr.upload) {
          xhr.upload.onprogress = onProgress;
        }

        const handleLoad = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              setBatchProgress(Array(files.length).fill(100));

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

          let serverMessage = '';
          try {
            const body = xhr.response && typeof xhr.response === 'object'
              ? xhr.response
              : JSON.parse(xhr.responseText || '{}');
            serverMessage = body?.message || '';
          } catch {
            // ignore parse errors
          }

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
      xhrRef.current = null;
      setIsUploading(false);
    }
  }, []);

  return { upload, uploadMany, progress, batchProgress, isUploading, resetProgress, abort };
}