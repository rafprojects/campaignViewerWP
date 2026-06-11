import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import type { LayoutGraphicLayer } from '@/types';
import { GraphicLayerPropertiesPanel } from './GraphicLayerPropertiesPanel';

const SAMPLE_OVERLAY: LayoutGraphicLayer = {
  id: 'overlay-1',
  imageUrl: 'https://picsum.photos/seed/overlay/200/100',
  x: 10,
  y: 10,
  width: 40,
  height: 20,
  zIndex: 10,
  opacity: 1,
  pointerEvents: false,
  name: 'Logo overlay',
  visible: true,
  locked: false,
};

const meta = {
  title: 'Admin/LayoutBuilder/GraphicLayerPropertiesPanel',
  component: GraphicLayerPropertiesPanel,
  parameters: { layout: 'padded' },
  args: {
    overlay: SAMPLE_OVERLAY,
    overlayIndex: 1,
    onUpdate: fn(),
    onRename: fn(),
    onRemove: fn(),
    onBringToFront: fn(),
    onSendToBack: fn(),
    onBringForward: fn(),
    onSendBackward: fn(),
  },
} satisfies Meta<typeof GraphicLayerPropertiesPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Locked: Story = {
  args: {
    overlay: { ...SAMPLE_OVERLAY, locked: true },
  },
};

export const Hidden: Story = {
  args: {
    overlay: { ...SAMPLE_OVERLAY, visible: false },
  },
};

export const LowOpacity: Story = {
  args: {
    overlay: { ...SAMPLE_OVERLAY, opacity: 0.3 },
  },
};
