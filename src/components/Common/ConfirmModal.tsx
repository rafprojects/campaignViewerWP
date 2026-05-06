import { Button, Group, Modal, Stack, Text } from '@mantine/core';
import type { ReactNode } from 'react';
import { getWpsgDebugProps } from '@/utils/wpsgDebug';

interface ConfirmModalProps {
  opened: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  confirmColor?: string;
  confirmAriaLabel?: string;
  loading?: boolean;
  /** Optional extra content rendered between the message and action buttons. */
  children?: ReactNode;
}

interface ConfirmModalContentProps {
  message: ReactNode;
  children?: ReactNode;
  onClose: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  confirmColor: string;
  confirmAriaLabel?: string;
  loading: boolean;
}

function ConfirmModalContent({
  message,
  children,
  onClose,
  onConfirm,
  confirmLabel,
  confirmColor,
  confirmAriaLabel,
  loading,
}: ConfirmModalContentProps) {
  return (
    <Stack {...getWpsgDebugProps('ConfirmModal', 'stack')}>
      {typeof message === 'string' ? <Text>{message}</Text> : message}
      {children}
      <Group {...getWpsgDebugProps('ConfirmModal', 'actions')} justify="flex-end">
        <Button variant="default" onClick={onClose}>Cancel</Button>
        <Button
          color={confirmColor}
          onClick={onConfirm}
          loading={loading}
          aria-label={confirmAriaLabel}
        >
          {confirmLabel}
        </Button>
      </Group>
    </Stack>
  );
}

export function ConfirmModal({
  opened,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  confirmColor = 'red',
  confirmAriaLabel,
  loading = false,
  children,
}: ConfirmModalProps) {
  return (
    <Modal
      {...getWpsgDebugProps('ConfirmModal')}
      opened={opened}
      onClose={onClose}
      title={<span {...getWpsgDebugProps('ConfirmModal', 'title')}>{title}</span>}
      closeButtonProps={getWpsgDebugProps('ConfirmModal', 'close')}
      overlayProps={getWpsgDebugProps('ConfirmModal', 'overlay')}
      padding="md"
    >
      <ConfirmModalContent
        message={message}
        children={children}
        onClose={onClose}
        onConfirm={onConfirm}
        confirmLabel={confirmLabel}
        confirmColor={confirmColor}
        confirmAriaLabel={confirmAriaLabel}
        loading={loading}
      />
    </Modal>
  );
}
