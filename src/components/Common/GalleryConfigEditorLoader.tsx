import { Center, Loader, Stack, Text } from '@mantine/core';

interface GalleryConfigEditorLoaderProps {
  minHeight?: number;
  message?: string;
}

export function GalleryConfigEditorLoader({
  minHeight = 220,
  message = 'Loading gallery config editor...',
}: GalleryConfigEditorLoaderProps) {
  return (
    <Center py="xl" mih={minHeight}>
      <Stack align="center" gap="xs">
        <Loader size="sm" />
        <Text size="sm" c="dimmed">
          {message}
        </Text>
      </Stack>
    </Center>
  );
}