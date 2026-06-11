import type { Meta, StoryObj } from '@storybook/react';
import { FIXTURE_MEDIA, FIXTURE_SETTINGS, FIXTURE_RUNTIME, FIXTURE_CONTAINER } from '@/stories/adapterFixtures';
import { JustifiedGallery } from './JustifiedGallery';

const meta = {
  title: 'Adapters/Justified',
  component: JustifiedGallery,
  parameters: { layout: 'padded' },
  args: {
    media: FIXTURE_MEDIA,
    settings: FIXTURE_SETTINGS,
    runtime: FIXTURE_RUNTIME,
    containerDimensions: FIXTURE_CONTAINER,
  },
} satisfies Meta<typeof JustifiedGallery>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
