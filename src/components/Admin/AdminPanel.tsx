import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ApiClient } from '@/services/apiClient';
import type { Campaign, CampaignAccessGrant, MediaItem } from '@/types';
import styles from './AdminPanel.module.scss';

type AdminTab = 'campaigns' | 'media' | 'access' | 'audit';

type AdminCampaign = Pick<Campaign, 'id' | 'title' | 'description' | 'status' | 'visibility' | 'createdAt' | 'updatedAt'> & {
  companyId: string;
  tags: string[];
};

interface ApiCampaignResponse {
  items: AdminCampaign[];
}

interface UploadResponse {
  attachmentId: number;
  url: string;
}

interface AuditEntry {
  id: string;
  action: string;
  details: Record<string, unknown>;
  userId: number;
  createdAt: string;
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

const companySlugPattern = /^[a-z0-9_-]+$/i;

export function AdminPanel({ apiClient, onClose, onCampaignsUpdated, onNotify }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('campaigns');
  const [campaigns, setCampaigns] = useState<AdminCampaign[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingCampaign, setEditingCampaign] = useState<AdminCampaign | null>(null);
  const [formState, setFormState] = useState({ ...emptyForm });
  const [campaignErrors, setCampaignErrors] = useState<{ title?: string; company?: string }>({});
  const [mediaCampaignId, setMediaCampaignId] = useState<string>('');
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [mediaEdits, setMediaEdits] = useState<Record<string, Partial<{ caption: string; order: number; thumbnail: string }>>>({});
  const [mediaForm, setMediaForm] = useState({
    type: 'video' as MediaItem['type'],
    source: 'external' as MediaItem['source'],
    url: '',
    caption: '',
    thumbnail: '',
    order: '',
    file: null as File | null,
  });
  const [mediaFormError, setMediaFormError] = useState<string | null>(null);
  const [accessCampaignId, setAccessCampaignId] = useState<string>('');
  const [accessEntries, setAccessEntries] = useState<CampaignAccessGrant[]>([]);
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [accessForm, setAccessForm] = useState({
    userId: '',
    source: 'campaign' as CampaignAccessGrant['source'],
    action: 'grant' as 'grant' | 'deny',
  });
  const [accessFormError, setAccessFormError] = useState<string | null>(null);
  const [auditCampaignId, setAuditCampaignId] = useState<string>('');
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);

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

  useEffect(() => {
    if (activeTab !== 'campaigns' && campaigns.length === 0) {
      void loadCampaigns();
    }
  }, [activeTab, campaigns.length, loadCampaigns]);

  useEffect(() => {
    if (activeTab === 'media' && !mediaCampaignId && campaigns.length > 0) {
      setMediaCampaignId(campaigns[0].id);
    }
  }, [activeTab, campaigns, mediaCampaignId]);

  useEffect(() => {
    if (activeTab === 'access' && !accessCampaignId && campaigns.length > 0) {
      setAccessCampaignId(campaigns[0].id);
    }
  }, [activeTab, accessCampaignId, campaigns]);

  useEffect(() => {
    if (activeTab === 'audit' && !auditCampaignId && campaigns.length > 0) {
      setAuditCampaignId(campaigns[0].id);
    }
  }, [activeTab, auditCampaignId, campaigns]);

  const loadMedia = useCallback(async (campaignId: string) => {
    if (!campaignId) return;
    setMediaLoading(true);
    setMediaError(null);
    try {
      const response = await apiClient.get<MediaItem[]>(`/wp-json/wp-super-gallery/v1/campaigns/${campaignId}/media`);
      setMediaItems(response ?? []);
      setMediaEdits({});
    } catch (err) {
      setMediaError(err instanceof Error ? err.message : 'Failed to load media');
    } finally {
      setMediaLoading(false);
    }
  }, [apiClient]);

  useEffect(() => {
    if (activeTab === 'media' && mediaCampaignId) {
      void loadMedia(mediaCampaignId);
    }
  }, [activeTab, loadMedia, mediaCampaignId]);

  const loadAccess = useCallback(async (campaignId: string) => {
    if (!campaignId) return;
    setAccessLoading(true);
    setAccessError(null);
    try {
      const response = await apiClient.get<CampaignAccessGrant[]>(
        `/wp-json/wp-super-gallery/v1/campaigns/${campaignId}/access`,
      );
      setAccessEntries(response ?? []);
    } catch (err) {
      setAccessError(err instanceof Error ? err.message : 'Failed to load access');
    } finally {
      setAccessLoading(false);
    }
  }, [apiClient]);

  const loadAudit = useCallback(async (campaignId: string) => {
    if (!campaignId) return;
    setAuditLoading(true);
    setAuditError(null);
    try {
      const response = await apiClient.get<AuditEntry[]>(`/wp-json/wp-super-gallery/v1/campaigns/${campaignId}/audit`);
      setAuditEntries(response ?? []);
    } catch (err) {
      setAuditError(err instanceof Error ? err.message : 'Failed to load audit trail');
    } finally {
      setAuditLoading(false);
    }
  }, [apiClient]);

  useEffect(() => {
    if (activeTab === 'access' && accessCampaignId) {
      void loadAccess(accessCampaignId);
    }
  }, [activeTab, accessCampaignId, loadAccess]);

  useEffect(() => {
    if (activeTab === 'audit' && auditCampaignId) {
      void loadAudit(auditCampaignId);
    }
  }, [activeTab, auditCampaignId, loadAudit]);

  useEffect(() => {
    if (accessForm.source === 'company' && accessForm.action !== 'grant') {
      setAccessForm((prev) => ({ ...prev, action: 'grant' }));
    }
  }, [accessForm.action, accessForm.source]);

  const handleEdit = (campaign: AdminCampaign) => {
    setEditingCampaign(campaign);
    setCampaignErrors({});
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
    setCampaignErrors({});
    setFormState({ ...emptyForm });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: { title?: string; company?: string } = {};
    if (!formState.title.trim()) {
      nextErrors.title = 'Title is required.';
    }
    if (formState.company && !companySlugPattern.test(formState.company)) {
      nextErrors.company = 'Company slug can only include letters, numbers, underscores, and dashes.';
    }
    setCampaignErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

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
  ), [campaigns, error, handleArchive, handleCreate, handleEdit, isLoading]);

  const handleMediaFieldChange = (mediaId: string, field: 'caption' | 'order' | 'thumbnail', value: string) => {
    setMediaEdits((prev) => {
      const current = prev[mediaId] ?? {};
      if (field === 'order') {
        return {
          ...prev,
          [mediaId]: { ...current, order: Number(value) || 0 },
        };
      }
      return {
        ...prev,
        [mediaId]: { ...current, [field]: value },
      };
    });
  };

  const handleSaveMedia = async (media: MediaItem) => {
    if (!mediaCampaignId) return;
    const edits = mediaEdits[media.id] ?? {};
    try {
      await apiClient.put(`/wp-json/wp-super-gallery/v1/campaigns/${mediaCampaignId}/media/${media.id}`,
        {
          caption: edits.caption ?? media.caption ?? '',
          order: edits.order ?? media.order ?? 0,
          thumbnail: edits.thumbnail ?? media.thumbnail ?? '',
        },
      );
      onNotify({ type: 'success', text: 'Media updated.' });
      await loadMedia(mediaCampaignId);
      onCampaignsUpdated();
    } catch (err) {
      onNotify({ type: 'error', text: err instanceof Error ? err.message : 'Failed to update media.' });
    }
  };

  const handleDeleteMedia = async (media: MediaItem) => {
    if (!mediaCampaignId) return;
    const confirmed = window.confirm('Remove this media item?');
    if (!confirmed) return;
    try {
      await apiClient.delete(`/wp-json/wp-super-gallery/v1/campaigns/${mediaCampaignId}/media/${media.id}`);
      onNotify({ type: 'success', text: 'Media removed.' });
      await loadMedia(mediaCampaignId);
      onCampaignsUpdated();
    } catch (err) {
      onNotify({ type: 'error', text: err instanceof Error ? err.message : 'Failed to delete media.' });
    }
  };

  const nextMediaOrder = useMemo(() => {
    if (mediaItems.length === 0) return 1;
    return Math.max(...mediaItems.map((item) => item.order ?? 0)) + 1;
  }, [mediaItems]);

  const isCampaignFormValid = formState.title.trim().length > 0
    && (!formState.company || companySlugPattern.test(formState.company));

  const handleMediaSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!mediaCampaignId) {
      setMediaFormError('Select a campaign first.');
      return;
    }

    setMediaFormError(null);
    if (mediaForm.source === 'external') {
      if (!mediaForm.url.trim()) {
        setMediaFormError('Provide a media URL.');
        return;
      }
      try {
        const parsed = new URL(mediaForm.url);
        if (parsed.protocol !== 'https:') {
          setMediaFormError('Media URL must use HTTPS.');
          return;
        }
      } catch {
        setMediaFormError('Media URL is invalid.');
        return;
      }
    }
    if (mediaForm.source === 'upload' && !mediaForm.file) {
      setMediaFormError('Select a file to upload.');
      return;
    }
    const orderValue = mediaForm.order ? Math.max(0, Number(mediaForm.order)) : nextMediaOrder;
    try {
      if (mediaForm.source === 'upload') {
        const file = mediaForm.file;
        if (!file) {
          setMediaFormError('Select a file to upload.');
          return;
        }
        const formData = new FormData();
        formData.append('file', file);
        const upload = await apiClient.postForm<UploadResponse>(
          '/wp-json/wp-super-gallery/v1/media/upload',
          formData,
        );
        await apiClient.post(`/wp-json/wp-super-gallery/v1/campaigns/${mediaCampaignId}/media`, {
          type: mediaForm.type,
          source: 'upload',
          attachmentId: upload.attachmentId,
          caption: mediaForm.caption,
          thumbnail: mediaForm.thumbnail,
          order: orderValue,
        });
      } else {
        if (!mediaForm.url) {
          onNotify({ type: 'error', text: 'Provide a media URL.' });
          return;
        }
        await apiClient.post(`/wp-json/wp-super-gallery/v1/campaigns/${mediaCampaignId}/media`, {
          type: mediaForm.type,
          source: 'external',
          url: mediaForm.url,
          caption: mediaForm.caption,
          thumbnail: mediaForm.thumbnail,
          order: orderValue,
        });
      }
      onNotify({ type: 'success', text: 'Media added.' });
      setMediaForm({
        type: 'video',
        source: 'external',
        url: '',
        caption: '',
        thumbnail: '',
        order: '',
        file: null,
      });
      await loadMedia(mediaCampaignId);
      onCampaignsUpdated();
    } catch (err) {
      onNotify({ type: 'error', text: err instanceof Error ? err.message : 'Failed to add media.' });
    }
  };

  const handleAccessSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!accessCampaignId) {
      setAccessFormError('Select a campaign first.');
      return;
    }
    setAccessFormError(null);
    const userId = Number(accessForm.userId);
    if (!userId) {
      setAccessFormError('Enter a valid user ID.');
      return;
    }
    try {
      await apiClient.post(`/wp-json/wp-super-gallery/v1/campaigns/${accessCampaignId}/access`, {
        userId,
        source: accessForm.source,
        action: accessForm.source === 'company' ? 'grant' : accessForm.action,
      });
      onNotify({ type: 'success', text: 'Access updated.' });
      setAccessForm({ userId: '', source: accessForm.source, action: 'grant' });
      await loadAccess(accessCampaignId);
      onCampaignsUpdated();
    } catch (err) {
      onNotify({ type: 'error', text: err instanceof Error ? err.message : 'Failed to update access.' });
    }
  };

  const handleRevokeAccess = async (entry: CampaignAccessGrant) => {
    if (!accessCampaignId) return;
    const confirmed = window.confirm(`Revoke access for user ${entry.userId}?`);
    if (!confirmed) return;
    try {
      await apiClient.delete(`/wp-json/wp-super-gallery/v1/campaigns/${accessCampaignId}/access/${entry.userId}`);
      onNotify({ type: 'success', text: 'Access revoked.' });
      await loadAccess(accessCampaignId);
      onCampaignsUpdated();
    } catch (err) {
      onNotify({ type: 'error', text: err instanceof Error ? err.message : 'Failed to revoke access.' });
    }
  };

  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <div>
          <h2>Admin Panel</h2>
          <p className={styles.subtitle}>Manage campaigns, media, and access control.</p>
        </div>
        <button type="button" className={styles.backButton} onClick={onClose}>
          Back to Gallery
        </button>
      </header>

      <div className={styles.tabs} role="tablist" aria-label="Admin panels">
        <button
          type="button"
          className={activeTab === 'campaigns' ? styles.tabActive : styles.tab}
          role="tab"
          aria-selected={activeTab === 'campaigns'}
          onClick={() => setActiveTab('campaigns')}
        >
          Campaigns
        </button>
        <button
          type="button"
          className={activeTab === 'media' ? styles.tabActive : styles.tab}
          role="tab"
          aria-selected={activeTab === 'media'}
          onClick={() => setActiveTab('media')}
        >
          Media
        </button>
        <button
          type="button"
          className={activeTab === 'access' ? styles.tabActive : styles.tab}
          role="tab"
          aria-selected={activeTab === 'access'}
          onClick={() => setActiveTab('access')}
        >
          Access
        </button>
        <button
          type="button"
          className={activeTab === 'audit' ? styles.tabActive : styles.tab}
          role="tab"
          aria-selected={activeTab === 'audit'}
          onClick={() => setActiveTab('audit')}
        >
          Audit
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
                className={campaignErrors.title ? styles.inputError : undefined}
                value={formState.title}
                onChange={(event) => {
                  setFormState((prev) => ({ ...prev, title: event.target.value }));
                  if (campaignErrors.title) {
                    setCampaignErrors((prev) => ({ ...prev, title: undefined }));
                  }
                }}
                required
              />
              {campaignErrors.title && <span className={styles.fieldError}>{campaignErrors.title}</span>}
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
                  className={campaignErrors.company ? styles.inputError : undefined}
                  value={formState.company}
                  onChange={(event) => {
                    setFormState((prev) => ({ ...prev, company: event.target.value }));
                    if (campaignErrors.company) {
                      setCampaignErrors((prev) => ({ ...prev, company: undefined }));
                    }
                  }}
                />
                {campaignErrors.company && <span className={styles.fieldError}>{campaignErrors.company}</span>}
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
              <button type="submit" className={styles.primaryButton} disabled={!isCampaignFormValid}>
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
        <div className={styles.content}>
          <div className={styles.panelCard}>
            <div className={styles.sectionHeader}>
              <h3>Campaign Media</h3>
              <select
                value={mediaCampaignId}
                onChange={(event) => {
                  setMediaCampaignId(event.target.value);
                  if (mediaFormError) setMediaFormError(null);
                }}
                className={styles.selectInline}
              >
                <option value="" disabled>
                  Select campaign
                </option>
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.title}
                  </option>
                ))}
              </select>
            </div>
            {mediaLoading ? (
              <p className={styles.muted}>Loading media...</p>
            ) : mediaError ? (
              <p className={styles.error}>{mediaError}</p>
            ) : mediaItems.length === 0 ? (
              <p className={styles.muted}>No media items yet.</p>
            ) : (
              <div className={styles.mediaList}>
                {mediaItems
                  .slice()
                  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                  .map((media) => {
                    const editState = {
                      caption: mediaEdits[media.id]?.caption ?? media.caption ?? '',
                      order: mediaEdits[media.id]?.order ?? media.order ?? 0,
                      thumbnail: mediaEdits[media.id]?.thumbnail ?? media.thumbnail ?? '',
                    };
                    return (
                      <div key={media.id} className={styles.mediaRow}>
                        <div>
                          <p className={styles.mediaTitle}>{media.type} · {media.source}</p>
                          <a href={media.url} target="_blank" rel="noreferrer" className={styles.mediaLink}>
                            {media.url}
                          </a>
                          {media.thumbnail && (
                            <img className={styles.mediaThumb} src={media.thumbnail} alt="Thumbnail" />
                          )}
                        </div>
                        <div className={styles.mediaControls}>
                          <label>
                            Caption
                            <input
                              value={editState.caption}
                              onChange={(event) => handleMediaFieldChange(media.id, 'caption', event.target.value)}
                            />
                          </label>
                          <label>
                            Order
                            <input
                              type="number"
                              value={editState.order}
                              onChange={(event) => handleMediaFieldChange(media.id, 'order', event.target.value)}
                            />
                          </label>
                          <label>
                            Thumbnail URL
                            <input
                              value={editState.thumbnail}
                              onChange={(event) => handleMediaFieldChange(media.id, 'thumbnail', event.target.value)}
                            />
                          </label>
                          <div className={styles.rowActions}>
                            <button type="button" className={styles.primaryButton} onClick={() => handleSaveMedia(media)}>
                              Save
                            </button>
                            <button type="button" className={styles.dangerButton} onClick={() => handleDeleteMedia(media)}>
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
          <form className={styles.panelCard} onSubmit={handleMediaSubmit}>
            <h3>Add Media</h3>
            <div className={styles.formRow}>
              <label>
                Type
                <select
                  value={mediaForm.type}
                  onChange={(event) => setMediaForm((prev) => ({ ...prev, type: event.target.value as MediaItem['type'] }))}
                >
                  <option value="video">Video</option>
                  <option value="image">Image</option>
                </select>
              </label>
              <label>
                Source
                <select
                  value={mediaForm.source}
                  onChange={(event) => {
                    setMediaForm((prev) => ({ ...prev, source: event.target.value as MediaItem['source'] }));
                    if (mediaFormError) setMediaFormError(null);
                  }}
                >
                  <option value="external">External</option>
                  <option value="upload">Upload</option>
                </select>
              </label>
              <label>
                Order
                <input
                  type="number"
                  placeholder={`${nextMediaOrder}`}
                  value={mediaForm.order}
                  onChange={(event) => setMediaForm((prev) => ({ ...prev, order: event.target.value }))}
                />
              </label>
            </div>
            {mediaForm.source === 'external' ? (
              <label>
                Media URL
                <input
                  value={mediaForm.url}
                  onChange={(event) => {
                    setMediaForm((prev) => ({ ...prev, url: event.target.value }));
                    if (mediaFormError) setMediaFormError(null);
                  }}
                  placeholder="https://..."
                  required
                />
              </label>
            ) : (
              <label>
                Upload File
                <input
                  type="file"
                  accept={mediaForm.type === 'image' ? 'image/*' : 'video/*'}
                  onChange={(event) => {
                    setMediaForm((prev) => ({ ...prev, file: event.target.files?.[0] ?? null }));
                    if (mediaFormError) setMediaFormError(null);
                  }}
                  required
                />
              </label>
            )}
            <label>
              Caption
              <input
                value={mediaForm.caption}
                onChange={(event) => setMediaForm((prev) => ({ ...prev, caption: event.target.value }))}
              />
            </label>
            <label>
              Thumbnail URL (optional)
              <input
                value={mediaForm.thumbnail}
                onChange={(event) => setMediaForm((prev) => ({ ...prev, thumbnail: event.target.value }))}
              />
            </label>
            <div className={styles.formActions}>
              <button type="submit" className={styles.primaryButton} disabled={!mediaCampaignId}>
                Add Media
              </button>
            </div>
            {mediaFormError && <p className={styles.error}>{mediaFormError}</p>}
          </form>
        </div>
      )}

      {activeTab === 'access' && (
        <div className={styles.content}>
          <div className={styles.panelCard}>
            <div className={styles.sectionHeader}>
              <h3>Campaign Access</h3>
              <select
                value={accessCampaignId}
                onChange={(event) => {
                  setAccessCampaignId(event.target.value);
                  if (accessFormError) setAccessFormError(null);
                }}
                className={styles.selectInline}
              >
                <option value="" disabled>
                  Select campaign
                </option>
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.title}
                  </option>
                ))}
              </select>
            </div>
            {accessLoading ? (
              <p className={styles.muted}>Loading access...</p>
            ) : accessError ? (
              <p className={styles.error}>{accessError}</p>
            ) : accessEntries.length === 0 ? (
              <p className={styles.muted}>No explicit access grants.</p>
            ) : (
              <div className={styles.accessList}>
                <div className={styles.accessRowHeader}>
                  <span>User ID</span>
                  <span>Source</span>
                  <span>Granted</span>
                  <span>Actions</span>
                </div>
                {accessEntries.map((entry) => (
                  <div key={`${entry.userId}-${entry.source}`} className={styles.accessRow}>
                    <span>{entry.userId}</span>
                    <span className={styles.badgeSecondary}>{entry.source}</span>
                    <span>{entry.grantedAt ? new Date(entry.grantedAt).toLocaleString() : '—'}</span>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={() => handleRevokeAccess(entry)}
                    >
                      Revoke
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className={styles.mutedSmall}>Deny overrides are not listed here.</p>
          </div>
          <form className={styles.panelCard} onSubmit={handleAccessSubmit}>
            <h3>Grant or Deny Access</h3>
            <div className={styles.formRow}>
              <label>
                User ID
                <input
                  value={accessForm.userId}
                  onChange={(event) => {
                    setAccessForm((prev) => ({ ...prev, userId: event.target.value }));
                    if (accessFormError) setAccessFormError(null);
                  }}
                  required
                />
              </label>
              <label>
                Source
                <select
                  value={accessForm.source}
                  onChange={(event) => setAccessForm((prev) => ({ ...prev, source: event.target.value as CampaignAccessGrant['source'] }))}
                >
                  <option value="campaign">Campaign</option>
                  <option value="company">Company</option>
                </select>
              </label>
              <label>
                Action
                <select
                  value={accessForm.source === 'company' ? 'grant' : accessForm.action}
                  onChange={(event) => setAccessForm((prev) => ({ ...prev, action: event.target.value as 'grant' | 'deny' }))}
                  disabled={accessForm.source === 'company'}
                >
                  <option value="grant">Grant</option>
                  <option value="deny">Deny</option>
                </select>
              </label>
            </div>
            <div className={styles.formActions}>
              <button type="submit" className={styles.primaryButton} disabled={!accessCampaignId}>
                Apply Access
              </button>
            </div>
            {accessFormError && <p className={styles.error}>{accessFormError}</p>}
          </form>
        </div>
      )}

      {activeTab === 'audit' && (
        <div className={styles.content}>
          <div className={styles.panelCard}>
            <div className={styles.sectionHeader}>
              <h3>Audit Trail</h3>
              <select
                value={auditCampaignId}
                onChange={(event) => setAuditCampaignId(event.target.value)}
                className={styles.selectInline}
              >
                <option value="" disabled>
                  Select campaign
                </option>
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.title}
                  </option>
                ))}
              </select>
            </div>
            {auditLoading ? (
              <p className={styles.muted}>Loading audit trail...</p>
            ) : auditError ? (
              <p className={styles.error}>{auditError}</p>
            ) : auditEntries.length === 0 ? (
              <p className={styles.muted}>No audit entries yet.</p>
            ) : (
              <div className={styles.auditList}>
                <div className={styles.auditRowHeader}>
                  <span>When</span>
                  <span>Action</span>
                  <span>User</span>
                  <span>Details</span>
                </div>
                {auditEntries
                  .slice()
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .map((entry) => (
                    <div key={entry.id} className={styles.auditRow}>
                      <span>{entry.createdAt ? new Date(entry.createdAt).toLocaleString() : '—'}</span>
                      <span className={styles.badgeSecondary}>{entry.action}</span>
                      <span>{entry.userId || '—'}</span>
                      <span className={styles.auditDetails}>
                        {Object.keys(entry.details ?? {}).length > 0
                          ? JSON.stringify(entry.details)
                          : '—'}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
