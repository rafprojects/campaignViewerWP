import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import type { LayoutTemplate } from '@/types';
import { DEFAULT_LAYOUT_SLOT } from '@/types';
import { FIXTURE_MEDIA } from '@/stories/adapterFixtures';
import { LayoutCanvas } from './LayoutCanvas';

const TEMPLATE_3SLOT: LayoutTemplate = {
  id: 'story-3slot',
  name: '3-Slot Story Template',
  schemaVersion: 1,
  canvasAspectRatio: 16 / 9,
  canvasMinWidth: 400,
  canvasMaxWidth: 900,
  backgroundColor: '#1a1a2e',
  overlays: [],
  groups: [],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  tags: [],
  slots: [
    { ...DEFAULT_LAYOUT_SLOT, id: 's1', x: 0, y: 0, width: 50, height: 100, zIndex: 1 },
    { ...DEFAULT_LAYOUT_SLOT, id: 's2', x: 50, y: 0, width: 25, height: 50, zIndex: 2 },
    { ...DEFAULT_LAYOUT_SLOT, id: 's3', x: 50, y: 50, width: 25, height: 50, zIndex: 3 },
  ],
};

const meta = {
  title: 'Admin/LayoutBuilder/LayoutCanvas',
  component: LayoutCanvas,
  parameters: { layout: 'padded' },
  args: {
    template: TEMPLATE_3SLOT,
    selectedSlotIds: new Set<string>(),
    isPreview: true,
    media: FIXTURE_MEDIA,
    snapMode: 'off',
    onSlotMove: fn(),
    onSlotResize: fn(),
    onSlotSelect: fn(),
    onSlotToggleSelect: fn(),
    onCanvasClick: fn(),
  },
} satisfies Meta<typeof LayoutCanvas>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Preview: Story = {};

export const WithGrid: Story = {
  args: {
    isPreview: false,
    showGrid: true,
    gridSizePx: 30,
    showRulers: true,
  },
};

export const SlotSelected: Story = {
  args: {
    isPreview: false,
    selectedSlotIds: new Set(['s1']),
  },
};
