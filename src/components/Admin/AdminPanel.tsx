import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ApiClient } from '@/services/apiClient';
import type { Campaign } from '@/types';
import styles from './AdminPanel.module.scss';

type AdminTab = 'campaigns' | 'media' | 'access';

type AdminCampaign = Pick<Campaign, 'id' | 'title' | 'description' | 'status' | 'visibility' | 'createdAt' | 'updatedAt'> & {
  companyId: string;
  tags: string[];
};

interface ApiCampaignResponse {
  items: AdminCampaign[];
}

interface AdminPanelProps {
  apiClient: ApiClient;
  onClose: () => void;
  onCampaignsUpdated: () => void;
  onNotify: (message: { type: 'error' | 'success'; text: string }) => void;
}

const emptyForm = {
  title: '',
  description: '',
  company: '',
  status: 'draft' as Campaign['status'],
  visibility: 'private' as Campaign['visibility'],
  tags: '',
};

export function AdminPanel({ apiClient, onClose, onCampaignsUpdated, onNotify }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('campaigns');
  const [campaigns, setCampaigns] = useState<AdminCampaign[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingCampaign, setEditingCampaign] = useState<AdminCampaign | null>(null);
  const [formState, setFormState] = useState({ ...emptyForm });

  const loadCampaigns = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<ApiCampaignResponse>('/wp-json/wp-super-gallery/v1/campaigns?per_page=50');
      setCampaigns(response.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load campaigns');
    } finally {
      setIsLoading(false);
    }
  }, [apiClient]);

  useEffect(() => {
    if (activeTab === 'campaigns') {
      void loadCampaigns();
    }
  }, [activeTab, loadCampaigns]);

  const handleEdit = (campaign: AdminCampaign) => {
    setEditingCampaign(campaign);
    setFormState({
      title: campaign.title ?? '',
      description: campaign.description ?? '',
      company: campaign.companyId ?? '',
      status: campaign.status ?? 'draft',
      visibility: campaign.visibility ?? 'private',
      tags: (campaign.tags ?? []).join(', '),
    });
  };

  const handleCreate = () => {
    setEditingCampaign(null);
    setFormState({ ...emptyForm });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const payload = {
      title: formState.title,
      description: formState.description,
      company: formState.company,
      status: formState.status,
      visibility: formState.visibility,
      tags: formState.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    };

    try {
      if (editingCampaign) {
        await apiClient.put(`/wp-json/wp-super-gallery/v1/campaigns/${editingCampaign.id}`, payload);
        onNotify({ type: 'success', text: 'Campaign updated.' });
      } else {
        await apiClient.post('/wp-json/wp-super-gallery/v1/campaigns', payload);
        onNotify({ type: 'success', text: 'Campaign created.' });
      }
      handleCreate();
      await loadCampaigns();
      onCampaignsUpdated();
    } catch (err) {
      onNotify({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save campaign.' });
    }
  };

  const handleArchive = async (campaign: AdminCampaign) => {
    const confirmed = window.confirm('Archive this campaign?');
    if (!confirmed) return;
    try {
      await apiClient.post(`/wp-json/wp-super-gallery/v1/campaigns/${campaign.id}/archive`, {});
      onNotify({ type: 'success', text: 'Campaign archived.' });
      await loadCampaigns();
      onCampaignsUpdated();
    } catch (err) {
      onNotify({ type: 'error', text: err instanceof Error ? err.message : 'Failed to archive campaign.' });
    }
  };

  const campaignsTable = useMemo(() => (
    <div className={styles.tableWrap}>
      <div className={styles.tableHeader}>
        <h3>Campaigns</h3>
        <button type="button" className={styles.primaryButton} onClick={handleCreate}>
          New Campaign
        </button>
      </div>
      {isLoading ? (
        <p className={styles.muted}>Loading campaigns...</p>
      ) : error ? (
        <p className={styles.error}>{error}</p>
      ) : (
        <div className={styles.table}>
          <div className={styles.tableRowHeader}>
            <span>Title</span>
            <span>Status</span>
            <span>Visibility</span>
            <span>Company</span>
            <span>Actions</span>
          </div>
          {campaigns.map((campaign) => (
            <div key={campaign.id} className={styles.tableRow}>
              <span>{campaign.title}</span>
              <span className={styles.badge}>{campaign.status}</span>
              <span className={styles.badgeSecondary}>{campaign.visibility}</span>
              <span>{campaign.companyId || '—'}</span>
              <div className={styles.rowActions}>
                <button type="button" className={styles.secondaryButton} onClick={() => handleEdit(campaign)}>
                  Edit
                </button>
                <button type="button" className={styles.dangerButton} onClick={() => handleArchive(campaign)}>
                  Archive
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  ), [campaigns, error, handleArchive, isLoading]);

  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <div>
          <h2>Admin Panel</h2>
          <p className={styles.subtitle}>Manage campaigns, media, and access control.</p>
        </div>
        <button type="button" className={styles.secondaryButton} onClick={onClose}>
          Back to Gallery
        </button>
      </header>

      <div className={styles.tabs}>
        <button
          type="button"
          className={activeTab === 'campaigns' ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab('campaigns')}
        >
          Campaigns
        </button>
        <button
          type="button"
          className={activeTab === 'media' ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab('media')}
        >
          Media
        </button>
        <button
          type="button"
          className={activeTab === 'access' ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab('access')}
        >
          Access
        </button>
      </div>

      {activeTab === 'campaigns' && (
        <div className={styles.content}>
          {campaignsTable}
          <form className={styles.form} onSubmit={handleSubmit}>
            <h3>{editingCampaign ? 'Edit Campaign' : 'Create Campaign'}</h3>
            <label>
              Title
              <input
                value={formState.title}
                onChange={(event) => setFormState((prev) => ({ ...prev, title: event.target.value }))}
                required
              />
            </label>
            <label>
              Description
              <textarea
                rows={4}
                value={formState.description}
                onChange={(event) => setFormState((prev) => ({ ...prev, description: event.target.value }))}
              />
            </label>
            <div className={styles.formRow}>
              <label>
                Company Slug
                <input
                  value={formState.company}
                  onChange={(event) => setFormState((prev) => ({ ...prev, company: event.target.value }))}
                />
              </label>
              <label>
                Status
                <select
                  value={formState.status}
                  onChange={(event) => setFormState((prev) => ({ ...prev, status: event.target.value as Campaign['status'] }))}
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </select>
              </label>
              <label>
                Visibility
                <select
                  value={formState.visibility}
                  onChange={(event) => setFormState((prev) => ({ ...prev, visibility: event.target.value as Campaign['visibility'] }))}
                >
                  <option value="private">Private</option>
                  <option value="public">Public</option>
                </select>
              </label>
            </div>
            <label>
              Tags (comma separated)
              <input
                value={formState.tags}
                onChange={(event) => setFormState((prev) => ({ ...prev, tags: event.target.value }))}
              />
            </label>
            <div className={styles.formActions}>
              <button type="submit" className={styles.primaryButton}>
                {editingCampaign ? 'Save Changes' : 'Create Campaign'}
              </button>
              {editingCampaign && (
                <button type="button" className={styles.secondaryButton} onClick={handleCreate}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {activeTab === 'media' && (
        <div className={styles.placeholder}>
          <p>Media management UI is next in Phase 3.</p>
        </div>
      )}

      {activeTab === 'access' && (
        <div className={styles.placeholder}>
          <p>User access management UI is next in Phase 3.</p>
        </div>
      )}
    </section>
  );
}
