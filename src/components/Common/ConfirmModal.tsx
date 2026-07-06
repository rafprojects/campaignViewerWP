import { Button, Group, Modal, Stack, Text } from '@mantine/core';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { getWpsgDebugProps, setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

interface ConfirmModalProps {
  opened: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  confirmColor?: string | undefined;
  confirmAriaLabel?: string | undefined;
  loading?: boolean | undefined;
  /** Optional extra content rendered between the message and action buttons. */
  children?: ReactNode | undefined;
}

interface ConfirmModalContentProps {
  message: ReactNode;
  children?: ReactNode | undefined;
  onClose: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  confirmColor: string;
  confirmAriaLabel?: string | undefined;
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
  const { t } = useTranslation('wpsg');
  return (
    <Stack {...getWpsgDebugProps('ConfirmModal', 'stack')}>
      {typeof message === 'string' ? <Text>{message}</Text> : message}
      {children}
      <Group {...getWpsgDebugProps('ConfirmModal', 'actions')} justify="flex-end">
        <Button variant="default" onClick={onClose}>{t('common_cancel', 'Cancel')}</Button>
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
      withinPortal={false}
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

setWpsgDebugDisplayName(ConfirmModal, 'ConfirmModal');
setWpsgDebugDisplayName(ConfirmModalContent, 'ConfirmModalContent');