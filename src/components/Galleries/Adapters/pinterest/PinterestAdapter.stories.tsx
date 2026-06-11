import type { Meta, StoryObj } from '@storybook/react';
import { FIXTURE_MEDIA, FIXTURE_SETTINGS, FIXTURE_RUNTIME, FIXTURE_CONTAINER } from '@/stories/adapterFixtures';
import { PinterestAdapter } from './PinterestAdapter';

const meta = {
  title: 'Adapters/Pinterest',
  component: PinterestAdapter,
  parameters: { layout: 'padded' },
  args: {
    media: FIXTURE_MEDIA,
    settings: FIXTURE_SETTINGS,
    runtime: FIXTURE_RUNTIME,
    containerDimensions: FIXTURE_CONTAINER,
  },
} satisfies Meta<typeof PinterestAdapter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
