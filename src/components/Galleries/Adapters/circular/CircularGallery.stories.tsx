import type { Meta, StoryObj } from '@storybook/react-vite';
import { FIXTURE_MEDIA, FIXTURE_SETTINGS, FIXTURE_RUNTIME, FIXTURE_CONTAINER } from '@/stories/adapterFixtures';
import { CircularGallery } from './CircularGallery';

const meta = {
  title: 'Adapters/Circular',
  component: CircularGallery,
  parameters: { layout: 'padded' },
  args: {
    media: FIXTURE_MEDIA,
    settings: FIXTURE_SETTINGS,
    runtime: FIXTURE_RUNTIME,
    containerDimensions: FIXTURE_CONTAINER,
  },
} satisfies Meta<typeof CircularGallery>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
