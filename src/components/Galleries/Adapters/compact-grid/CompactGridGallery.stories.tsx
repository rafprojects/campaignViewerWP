import type { Meta, StoryObj } from '@storybook/react';
import { FIXTURE_MEDIA, FIXTURE_SETTINGS, FIXTURE_RUNTIME, FIXTURE_CONTAINER } from '@/stories/adapterFixtures';
import { CompactGridGallery } from './CompactGridGallery';

const meta = {
  title: 'Adapters/CompactGrid',
  component: CompactGridGallery,
  parameters: { layout: 'padded' },
  args: {
    media: FIXTURE_MEDIA,
    settings: FIXTURE_SETTINGS,
    runtime: FIXTURE_RUNTIME,
    containerDimensions: FIXTURE_CONTAINER,
  },
} satisfies Meta<typeof CompactGridGallery>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
