import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { AssetUploader } from './AssetUploader';

const meta = {
  title: 'Admin/LayoutBuilder/AssetUploader',
  component: AssetUploader,
  parameters: { layout: 'centered' },
  args: {
    onFileSelect: fn(),
    onUrlSubmit: fn(),
  },
} satisfies Meta<typeof AssetUploader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const UploadOnly: Story = {
  render: ({ onUrlSubmit: _omit, ...args }) => <AssetUploader {...args} />,
};

export const Uploading: Story = {
  args: { isUploading: true },
};

export const Disabled: Story = {
  args: { disabled: true },
};
