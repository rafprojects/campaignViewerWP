import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useXhrUpload } from './useXhrUpload';

function createMockXhr() {
  const uploadListeners = new Map<string, (e: ProgressEvent) => void>();
  const listeners = new Map<string, () => void>();

  const mock = {
    open: vi.fn(),
    setRequestHeader: vi.fn(),
    send: vi.fn(),
    abort: vi.fn(),
    status: 200,
    response: null as unknown,
    responseText: '',
    upload: {
      addEventListener: vi.fn((event: string, handler: (e: ProgressEvent) => void) => {
        uploadListeners.set(event, handler);
      }),
    },
    addEventListener: vi.fn((event: string, handler: () => void) => {
      listeners.set(event, handler);
    }),
    _fireUploadProgress(loaded: number, total: number) {
      uploadListeners.get('progress')?.({ lengthComputable: true, loaded, total } as ProgressEvent);
    },
    _fireLoad() {
      listeners.get('load')?.();
    },
    _fireError() {
      listeners.get('error')?.();
    },
  };

  return mock;
}

type MockXhr = ReturnType<typeof createMockXhr>;

let mockXhr: MockXhr;

beforeEach(() => {
  mockXhr = createMockXhr();
  vi.stubGlobal('XMLHttpRequest', vi.fn(() => mockXhr));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function makeFile(name: string, sizeBytes: number, type = 'image/jpeg'): File {
  return new File(['x'.repeat(sizeBytes)], name, { type });
}

describe('useXhrUpload', () => {
  describe('upload', () => {
    it('updates progress state on progress events', async () => {
      mockXhr.status = 200;
      mockXhr.responseText = JSON.stringify({});

      const { result } = renderHook(() => useXhrUpload());

      await act(async () => {
        const promise = result.current.upload({
          url: 'https://example.com/upload',
          file: makeFile('test.jpg', 100),
        });
        mockXhr._fireUploadProgress(60, 100);
        mockXhr._fireLoad();
        await promise;
      });

      expect(result.current.progress).toBe(60);
    });

    it('resolves with parsed JSON and resets isUploading on success', async () => {
      mockXhr.status = 200;
      mockXhr.responseText = JSON.stringify({ id: 42, url: 'https://example.com/img.jpg' });

      const { result } = renderHook(() => useXhrUpload());

      let response: unknown;
      await act(async () => {
        const promise = result.current.upload({
          url: 'https://example.com/upload',
          file: makeFile('test.jpg', 100),
        });
        mockXhr._fireLoad();
        response = await promise;
      });

      expect(response).toEqual({ id: 42, url: 'https://example.com/img.jpg' });
      expect(result.current.isUploading).toBe(false);
    });

    it('rejects with 401 friendly message', async () => {
      mockXhr.status = 401;
      mockXhr.responseText = '{}';

      const { result } = renderHook(() => useXhrUpload());

      let caughtError: Error | undefined;
      await act(async () => {
        try {
          const promise = result.current.upload({
            url: 'https://example.com/upload',
            file: makeFile('test.jpg', 100),
          });
          mockXhr._fireLoad();
          await promise;
        } catch (err) {
          caughtError = err as Error;
        }
      });

      expect(caughtError?.message).toBe('Not authorized. Please sign in again.');
    });

    it('rejects with 413 friendly message', async () => {
      mockXhr.status = 413;
      mockXhr.responseText = '{}';

      const { result } = renderHook(() => useXhrUpload());

      let caughtError: Error | undefined;
      await act(async () => {
        try {
          const promise = result.current.upload({
            url: 'https://example.com/upload',
            file: makeFile('test.jpg', 100),
          });
          mockXhr._fireLoad();
          await promise;
        } catch (err) {
          caughtError = err as Error;
        }
      });

      expect(caughtError?.message).toBe('File too large for the server to accept.');
    });

    it('server message in response body overrides friendly fallback', async () => {
      mockXhr.status = 413;
      mockXhr.response = { message: 'Custom server message.' };

      const { result } = renderHook(() => useXhrUpload());

      let caughtError: Error | undefined;
      await act(async () => {
        try {
          const promise = result.current.upload({
            url: 'https://example.com/upload',
            file: makeFile('test.jpg', 100),
          });
          mockXhr._fireLoad();
          await promise;
        } catch (err) {
          caughtError = err as Error;
        }
      });

      expect(caughtError?.message).toBe('Custom server message.');
    });

    it('rejects on XHR network error', async () => {
      const { result } = renderHook(() => useXhrUpload());

      let caughtError: Error | undefined;
      await act(async () => {
        try {
          const promise = result.current.upload({
            url: 'https://example.com/upload',
            file: makeFile('test.jpg', 100),
          });
          mockXhr._fireError();
          await promise;
        } catch (err) {
          caughtError = err as Error;
        }
      });

      expect(caughtError?.message).toBe('Upload failed.');
    });
  });

  describe('abort', () => {
    it('clears progress, batchProgress, isUploading and calls xhr.abort', () => {
      const { result } = renderHook(() => useXhrUpload());

      act(() => {
        void result.current.upload({
          url: 'https://example.com/upload',
          file: makeFile('test.jpg', 100),
        });
      });

      expect(result.current.isUploading).toBe(true);

      act(() => {
        result.current.abort();
      });

      expect(mockXhr.abort).toHaveBeenCalled();
      expect(result.current.isUploading).toBe(false);
      expect(result.current.progress).toBeNull();
      expect(result.current.batchProgress).toBeNull();
    });
  });

  describe('unmount', () => {
    it('aborts an in-flight upload on unmount', () => {
      const { result, unmount } = renderHook(() => useXhrUpload());

      act(() => {
        void result.current.upload({
          url: 'https://example.com/upload',
          file: makeFile('test.jpg', 100),
        });
      });

      unmount();

      expect(mockXhr.abort).toHaveBeenCalled();
    });
  });

  describe('uploadMany', () => {
    it('correctly interpolates per-file progress from cumulative sizes', async () => {
      mockXhr.status = 200;
      mockXhr.responseText = JSON.stringify({ results: [] });

      const { result } = renderHook(() => useXhrUpload());

      const file1 = makeFile('a.jpg', 100);
      const file2 = makeFile('b.jpg', 200);

      let uploadPromise!: Promise<unknown>;

      act(() => {
        uploadPromise = result.current.uploadMany({
          url: 'https://example.com/upload',
          files: [file1, file2],
        });
      });

      // Fire progress at loaded=150 of total=300
      // file1 (100 bytes): min(max(150-0,0),100)=100 → 100%
      // file2 (200 bytes): min(max(150-100,0),200)=50 → 25%
      act(() => {
        mockXhr._fireUploadProgress(150, 300);
      });

      const progressSnapshot = result.current.batchProgress;

      await act(async () => {
        mockXhr._fireLoad();
        await uploadPromise;
      });

      expect(progressSnapshot).toEqual([100, 25]);
    });

    it('sets all batchProgress entries to 100 on success', async () => {
      mockXhr.status = 200;
      mockXhr.responseText = JSON.stringify({ results: [] });

      const { result } = renderHook(() => useXhrUpload());

      await act(async () => {
        const promise = result.current.uploadMany({
          url: 'https://example.com/upload',
          files: [makeFile('a.jpg', 100), makeFile('b.jpg', 200)],
        });
        mockXhr._fireLoad();
        await promise;
      });

      expect(result.current.batchProgress).toEqual([100, 100]);
    });

    it('rejects immediately for an empty files array without XHR', async () => {
      const { result } = renderHook(() => useXhrUpload());

      await expect(
        result.current.uploadMany({ url: 'https://example.com/upload', files: [] }),
      ).rejects.toThrow('No files selected for upload.');

      expect(result.current.isUploading).toBe(false);
      expect(vi.mocked(globalThis.XMLHttpRequest)).not.toHaveBeenCalled();
    });
  });
});
