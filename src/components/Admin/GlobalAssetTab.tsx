/** P52-B — Admin Panel "Assets" tab wrapper (lazy-loaded). */
import type { ApiClient } from '@/services/apiClient';
import { GlobalAssetManager } from './GlobalAssetManager';

interface GlobalAssetTabProps {
  apiClient: ApiClient;
  onNotify: (message: { type: 'error' | 'success'; text: string }) => void;
}

export default function GlobalAssetTab({ apiClient, onNotify }: GlobalAssetTabProps) {
  return <GlobalAssetManager apiClient={apiClient} onNotify={onNotify} />;
}
