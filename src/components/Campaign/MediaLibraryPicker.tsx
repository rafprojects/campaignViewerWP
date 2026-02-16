import { Badge, Button, Card, Center, Group, Image, Loader, SimpleGrid, Stack, Text, TextInput } from '@mantine/core';
import { IconPhoto } from '@tabler/icons-react';
import type { MediaItem } from '@/types';
import { FALLBACK_IMAGE_SRC } from '@/utils/fallback';

interface MediaLibraryPickerProps {
  libraryMedia: MediaItem[];
  libraryLoading: boolean;
  librarySearch: string;
  onLibrarySearchChange: (value: string) => void;
  onLoadLibrary: (search: string) => void;
  onAddFromLibrary: (media: MediaItem) => void;
  isAlreadyAdded: (media: MediaItem) => boolean;
}

export function MediaLibraryPicker({
  libraryMedia,
  libraryLoading,
  librarySearch,
  onLibrarySearchChange,
  onLoadLibrary,
  onAddFromLibrary,
  isAlreadyAdded,
}: MediaLibraryPickerProps) {
  return (
    <Card withBorder>
      <Stack gap="sm">
        <Group justify="space-between">
          <Group>
            <IconPhoto size={20} />
            <Text fw={500}>Pick from Media Library</Text>
          </Group>
          <Button
            variant="subtle"
            size="xs"
            onClick={() => void onLoadLibrary(librarySearch)}
            loading={libraryLoading}
          >
            {libraryMedia.length > 0 ? 'Refresh' : 'Load Library'}
          </Button>
        </Group>
        <TextInput
          placeholder="Search media..."
          aria-label="Search media library"
          value={librarySearch}
          onChange={(e) => onLibrarySearchChange(e.currentTarget.value)}
          onKeyDown={(e) => e.key === 'Enter' && void onLoadLibrary(librarySearch)}
        />
        {libraryLoading ? (
          <Center py="md"><Loader size="sm" /></Center>
        ) : libraryMedia.length === 0 ? (
          <Text size="sm" c="dimmed" ta="center" py="md">
            Click &quot;Load Library&quot; to browse existing media
          </Text>
        ) : (
          <SimpleGrid cols={{ base: 3, sm: 4, md: 5 }} spacing="xs">
            {libraryMedia.map((item) => {
              const alreadyAdded = isAlreadyAdded(item);
              return (
                <Card
                  key={item.id}
                  shadow="xs"
                  padding={0}
                  radius="sm"
                  withBorder
                  style={{
                    opacity: alreadyAdded ? 0.5 : 1,
                    cursor: alreadyAdded ? 'not-allowed' : 'pointer',
                  }}
                  onClick={() => !alreadyAdded && void onAddFromLibrary(item)}
                  role="button"
                  tabIndex={alreadyAdded ? -1 : 0}
                  aria-disabled={alreadyAdded}
                  aria-label={
                    alreadyAdded
                      ? 'Media already added to campaign'
                      : `Add ${item.type} media: ${item.caption || item.url}`
                  }
                  onKeyDown={(event) => {
                    if (alreadyAdded) return;
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      void onAddFromLibrary(item);
                    }
                  }}
                >
                  <Image
                    src={item.thumbnail || item.url}
                    height={60}
                    alt={item.caption || 'Media'}
                    fallbackSrc={FALLBACK_IMAGE_SRC}
                  />
                  <Stack gap={2} p={4}>
                    <Badge size="xs" variant="light">
                      {item.type}
                    </Badge>
                    {alreadyAdded && (
                      <Text size="xs" c="green">Added</Text>
                    )}
                  </Stack>
                </Card>
              );
            })}
          </SimpleGrid>
        )}
      </Stack>
    </Card>
  );
}
