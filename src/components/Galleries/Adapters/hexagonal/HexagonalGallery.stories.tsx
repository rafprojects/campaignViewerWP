import type { Meta, StoryObj } from '@storybook/react-vite';
import { FIXTURE_MEDIA, FIXTURE_SETTINGS, FIXTURE_RUNTIME, FIXTURE_CONTAINER } from '@/stories/adapterFixtures';
import { HexagonalGallery } from './HexagonalGallery';

const meta = {
  title: 'Adapters/Hexagonal',
  component: HexagonalGallery,
  parameters: { layout: 'padded' },
  args: {
    media: FIXTURE_MEDIA,
    settings: FIXTURE_SETTINGS,
    runtime: FIXTURE_RUNTIME,
    containerDimensions: FIXTURE_CONTAINER,
  },
} satisfies Meta<typeof HexagonalGallery>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
