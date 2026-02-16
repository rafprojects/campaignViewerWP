import { Button, Group, Modal, Stack, Text } from '@mantine/core';
import type { ReactNode } from 'react';

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
    <Modal opened={opened} onClose={onClose} title={title} padding="md">
      <Stack>
        {typeof message === 'string' ? <Text>{message}</Text> : message}
        {children}
        <Group justify="flex-end">
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
    </Modal>
  );
}
