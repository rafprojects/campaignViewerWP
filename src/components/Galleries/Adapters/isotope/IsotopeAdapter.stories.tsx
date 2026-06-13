import type { Meta, StoryObj } from '@storybook/react-vite';
import { FIXTURE_MEDIA, FIXTURE_SETTINGS, FIXTURE_RUNTIME, FIXTURE_CONTAINER } from '@/stories/adapterFixtures';
import type { MediaItem } from '@/types';
import { IsotopeAdapter } from './IsotopeAdapter';

const MIXED_MEDIA: MediaItem[] = [
  { id: 'm1', type: 'image', source: 'upload', url: 'https://picsum.photos/seed/iso1/800/600', thumbnail: 'https://picsum.photos/seed/iso1/400/300', width: 800, height: 600, order: 0, caption: 'Landscape A', dateUploaded: '2024-01-10 09:00:00' },
  { id: 'm2', type: 'video', source: 'external', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', thumbnail: 'https://picsum.photos/seed/iso2/400/300', width: 1280, height: 720, order: 1, caption: 'Video clip 1' },
  { id: 'm3', type: 'image', source: 'upload', url: 'https://picsum.photos/seed/iso3/600/800', thumbnail: 'https://picsum.photos/seed/iso3/300/400', width: 600, height: 800, order: 2, caption: 'Portrait B', dateUploaded: '2024-03-15 14:30:00' },
  { id: 'm4', type: 'image', source: 'upload', url: 'https://picsum.photos/seed/iso4/800/600', thumbnail: 'https://picsum.photos/seed/iso4/400/300', width: 800, height: 600, order: 3, caption: 'Landscape C', dateUploaded: '2024-06-01 10:00:00' },
  { id: 'm5', type: 'video', source: 'external', url: 'https://www.youtube.com/watch?v=9bZkp7q19f0', thumbnail: 'https://picsum.photos/seed/iso5/400/300', width: 1280, height: 720, order: 4, caption: 'Video clip 2' },
  { id: 'm6', type: 'image', source: 'upload', url: 'https://picsum.photos/seed/iso6/600/600', thumbnail: 'https://picsum.photos/seed/iso6/300/300', width: 600, height: 600, order: 5, caption: 'Square D', dateUploaded: '2023-11-20 08:00:00' },
];

const meta = {
  title: 'Adapters/Filterable Grid (Isotope)',
  component: IsotopeAdapter,
  parameters: { layout: 'padded' },
  args: {
    media: FIXTURE_MEDIA,
    settings: FIXTURE_SETTINGS,
    runtime: FIXTURE_RUNTIME,
    containerDimensions: FIXTURE_CONTAINER,
  },
} satisfies Meta<typeof IsotopeAdapter>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Images-only gallery — no filter chips rendered, just the sort control. */
export const Default: Story = {};

/**
 * Mixed images and videos — filter chips (All / Images / Videos) appear above
 * the grid. Click a chip to animate remaining items into their new positions
 * via the FLIP technique.
 */
export const WithMixedMedia: Story = {
  args: {
    media: MIXED_MEDIA,
  },
};
