import type { Meta, StoryObj } from '@storybook/react-vite';
import { FIXTURE_MEDIA, FIXTURE_SETTINGS, FIXTURE_RUNTIME, FIXTURE_CONTAINER } from '@/stories/adapterFixtures';
import { MasonryGallery } from './MasonryGallery';

const meta = {
  title: 'Adapters/Masonry',
  component: MasonryGallery,
  parameters: { layout: 'padded' },
  args: {
    media: FIXTURE_MEDIA,
    settings: FIXTURE_SETTINGS,
    runtime: FIXTURE_RUNTIME,
    containerDimensions: FIXTURE_CONTAINER,
  },
} satisfies Meta<typeof MasonryGallery>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
