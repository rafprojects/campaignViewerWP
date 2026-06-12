/**
 * P50-K — Space Asset Library (association manager).
 *
 * A visual, WordPress-media-style grid for choosing which global visual assets
 * a delegated space is allowed to use. Replaces the old flat checkbox list:
 * thumbnails with a checkered transparency backing + file-type badge, a search
 * box, a tag filter, and bulk select-all / clear-all over the filtered set.
 *
 * Association state is owned by the parent (SpaceManagementView); this component
 * is presentational + local filter state only.
 */
import { useMemo, useState } from 'react';
import { Box, Text, TextInput, Group, Button, Chip, Badge, Center, Loader } from '@mantine/core';
import { IconSearch, IconCheck } from '@tabler/icons-react';
import type { AssetLibraryItem } from '@/components/Admin/LayoutBuilder/BuilderDockContext';
import { CHECKERED_BG } from '@/utils/checkeredBg';
import { getAssetFileType } from '@/utils/assetFileType';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

export interface SpaceAssetLibraryProps {
  assets: AssetLibraryItem[];
  /** IDs of assets currently associated with the space. */
  associatedIds: string[];
  /** Toggle association for a single asset. */
  onToggle: (assetId: string, associated: boolean) => void;
  /** Bulk associate/dissociate a set of asset IDs (the currently-filtered view). */
  onBulkToggle: (assetIds: string[], associated: boolean) => void;
  loading?: boolean;
}

export function SpaceAssetLibrary({
  assets,
  associatedIds,
  onToggle,
  onBulkToggle,
  loading = false,
}: SpaceAssetLibraryProps) {
  const [search, setSearch] = useState('');
  const [activeTags, setActiveTags] = useState<string[]>([]);

  const associated = useMemo(() => new Set(associatedIds), [associatedIds]);

  // Distinct tags across all assets, for the filter chips.
  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const a of assets) for (const t of a.tags ?? []) set.add(t);
    return Array.from(set).sort((x, y) => x.localeCompare(y));
  }, [assets]);

  // Client-side filter: name match AND (no tag filter OR shares ≥1 active tag).
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return assets.filter((a) => {
      if (q && !a.name.toLowerCase().includes(q)) return false;
      if (activeTags.length > 0) {
        const tags = a.tags ?? [];
        if (!activeTags.some((t) => tags.includes(t))) return false;
      }
      return true;
    });
  }, [assets, search, activeTags]);

  const filteredIds = useMemo(() => filtered.map((a) => a.id), [filtered]);
  const allFilteredAssociated = filtered.length > 0 && filtered.every((a) => associated.has(a.id));

  if (loading) {
    return <Center py="md"><Loader size="sm" /></Center>;
  }

  if (!assets.length) {
    return <Text size="xs" c="dimmed">No assets in the global library yet. Upload assets from the Layout Builder.</Text>;
  }

  return (
    <Box>
      <Group gap="xs" mb="xs" wrap="wrap">
        <TextInput
          size="xs"
          placeholder="Search assets…"
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          leftSection={<IconSearch size={13} />}
          style={{ flex: 1, minWidth: 160 }}
          aria-label="Search assets"
        />
        <Button
          size="xs"
          variant="light"
          disabled={filtered.length === 0 || allFilteredAssociated}
          onClick={() => onBulkToggle(filteredIds, true)}
        >
          Select all
        </Button>
        <Button
          size="xs"
          variant="subtle"
          color="gray"
          disabled={filtered.every((a) => !associated.has(a.id))}
          onClick={() => onBulkToggle(filteredIds, false)}
        >
          Clear all
        </Button>
      </Group>

      {allTags.length > 0 && (
        <Chip.Group multiple value={activeTags} onChange={setActiveTags}>
          <Group gap={4} mb="xs" wrap="wrap">
            {allTags.map((tag) => (
              <Chip key={tag} value={tag} size="xs" variant="outline">{tag}</Chip>
            ))}
          </Group>
        </Chip.Group>
      )}

      {filtered.length === 0 ? (
        <Text size="xs" c="dimmed" py="sm">No assets match the current filter.</Text>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
            gap: 8,
          }}
        >
          {filtered.map((asset) => {
            const isOn = associated.has(asset.id);
            const fileType = getAssetFileType(asset.url);
            return (
              <Box
                key={asset.id}
                role="checkbox"
                aria-checked={isOn}
                aria-label={asset.name}
                tabIndex={0}
                onClick={() => onToggle(asset.id, !isOn)}
                onKeyDown={(e: React.KeyboardEvent) => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(asset.id, !isOn); }
                }}
                style={{
                  position: 'relative',
                  border: isOn
                    ? '2px solid var(--mantine-color-blue-5)'
                    : '2px solid var(--mantine-color-default-border)',
                  borderRadius: 6,
                  overflow: 'hidden',
                  cursor: 'pointer',
                }}
              >
                <div style={{ ...CHECKERED_BG, height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img
                    src={asset.url}
                    alt={asset.name}
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', opacity: isOn ? 1 : 0.85 }}
                    draggable={false}
                  />
                </div>

                {/* Selection check */}
                {isOn && (
                  <Box
                    style={{
                      position: 'absolute', top: 3, left: 3, zIndex: 1,
                      background: 'var(--mantine-color-blue-6)', borderRadius: '50%',
                      width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <IconCheck size={12} color="white" />
                  </Box>
                )}

                <Badge
                  size="xs" variant="filled" color="dark" radius="sm"
                  style={{ position: 'absolute', bottom: 3, right: 3, zIndex: 1, opacity: 0.78, pointerEvents: 'none' }}
                >
                  {fileType}
                </Badge>

                <Text size="10px" truncate px={4} py={2} title={asset.name}>{asset.name}</Text>
              </Box>
            );
          })}
        </div>
      )}
    </Box>
  );
}

setWpsgDebugDisplayName(SpaceAssetLibrary, 'AdminPanel:SpaceAssetLibrary');
