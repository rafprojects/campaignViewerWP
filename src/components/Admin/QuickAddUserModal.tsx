import type { Dispatch, SetStateAction } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Group,
  Modal,
  Select,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { IconAlertCircle, IconUserPlus } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { getWpsgDebugProps, setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

type AdminCampaign = {
  id: string;
  title: string;
  companyId: string;
  status: string;
};

type QuickAddResult = {
  success: boolean;
  message: string;
  resetUrl?: string | undefined;
};

interface QuickAddUserModalProps {
  opened: boolean;
  onClose: () => void;
  quickAddResult: QuickAddResult | null;
  quickAddEmail: string;
  setQuickAddEmail: Dispatch<SetStateAction<string>>;
  quickAddName: string;
  setQuickAddName: Dispatch<SetStateAction<string>>;
  quickAddRole: string;
  setQuickAddRole: Dispatch<SetStateAction<string>>;
  quickAddCampaignId: string;
  setQuickAddCampaignId: Dispatch<SetStateAction<string>>;
  quickAddTestMode: boolean;
  setQuickAddTestMode: Dispatch<SetStateAction<boolean>>;
  campaigns: AdminCampaign[];
  onSubmit: () => void;
  quickAddSaving: boolean;
  onNotify: (payload: { type: 'success' | 'error'; text: string }) => void;
}

interface QuickAddUserSuccessStateProps {
  quickAddResult: QuickAddResult;
  onClose: () => void;
  onNotify: (payload: { type: 'success' | 'error'; text: string }) => void;
}

function QuickAddUserSuccessState({ quickAddResult, onClose, onNotify }: QuickAddUserSuccessStateProps) {
  const { t } = useTranslation('wpsg');
  return (
    <>
      <Alert
        color={quickAddResult.success ? 'teal' : 'red'}
        title={quickAddResult.success ? t('admin_qau_success', 'Success') : t('admin_qau_error', 'Error')}
        role={quickAddResult.success ? 'status' : 'alert'}
        aria-live={quickAddResult.success ? 'polite' : 'assertive'}
      >
        <Text size="sm">{quickAddResult.message}</Text>
        {quickAddResult.resetUrl && (
          <Box mt="sm">
            <Text size="sm" fw={500}>{t('admin_qau_reset_link_label', 'Password Reset Link:')}</Text>
            <TextInput
              label={t('admin_qau_reset_link_input', 'Password reset link')}
              value={quickAddResult.resetUrl}
              readOnly
              onClick={(e) => (e.target as HTMLInputElement).select()}
              rightSection={(
                <Tooltip label={t('admin_qau_click_select', 'Click to select')}>
                  <IconAlertCircle size={16} />
                </Tooltip>
              )}
            />
            <Group mt="xs" gap="xs">
              <Button
                size="xs"
                variant="light"
                component="a"
                href={quickAddResult.resetUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('admin_qau_open_reset', 'Open Reset Link')}
              </Button>
              <Button
                size="xs"
                variant="subtle"
                onClick={() => {
                  navigator.clipboard.writeText(quickAddResult.resetUrl!);
                  onNotify({ type: 'success', text: t('admin_qau_url_copied', 'Reset URL copied to clipboard') });
                }}
              >
                {t('admin_qau_copy_link', 'Copy Link')}
              </Button>
            </Group>
            <Text size="xs" c="dimmed" mt="xs">
              {t('admin_qau_share_note', 'Share this link securely with the user. They can use it to set their own password.')}
            </Text>
          </Box>
        )}
      </Alert>
      <Group {...getWpsgDebugProps('QuickAddUserModal', 'success-actions')} justify="flex-end" wrap="wrap" gap="sm">
        <Button onClick={onClose}>{t('admin_qau_close', 'Close')}</Button>
      </Group>
    </>
  );
}

setWpsgDebugDisplayName(QuickAddUserSuccessState, 'AdminPanel:QuickAddUserModal:SuccessState');

interface QuickAddUserFormStateProps {
  quickAddEmail: string;
  setQuickAddEmail: Dispatch<SetStateAction<string>>;
  quickAddName: string;
  setQuickAddName: Dispatch<SetStateAction<string>>;
  quickAddRole: string;
  setQuickAddRole: Dispatch<SetStateAction<string>>;
  quickAddCampaignId: string;
  setQuickAddCampaignId: Dispatch<SetStateAction<string>>;
  quickAddTestMode: boolean;
  setQuickAddTestMode: Dispatch<SetStateAction<boolean>>;
  activeCampaigns: AdminCampaign[];
  onSubmit: () => void;
  onClose: () => void;
  quickAddSaving: boolean;
}

function QuickAddUserFormState({
  quickAddEmail,
  setQuickAddEmail,
  quickAddName,
  setQuickAddName,
  quickAddRole,
  setQuickAddRole,
  quickAddCampaignId,
  setQuickAddCampaignId,
  quickAddTestMode,
  setQuickAddTestMode,
  activeCampaigns,
  onSubmit,
  onClose,
  quickAddSaving,
}: QuickAddUserFormStateProps) {
  const { t } = useTranslation('wpsg');
  return (
    <>
      <TextInput
        label={t('admin_qau_email', 'Email')}
        placeholder={t('admin_qau_email_ph', 'user@example.com')}
        required
        value={quickAddEmail}
        onChange={(e) => setQuickAddEmail(e.currentTarget.value)}
        description={t('admin_qau_email_desc', "User's WordPress login email address")}
      />

      <TextInput
        label={t('admin_qau_name', 'Display Name')}
        placeholder={t('admin_qau_name_ph', 'John Doe')}
        required
        value={quickAddName}
        onChange={(e) => setQuickAddName(e.currentTarget.value)}
        description={t('admin_qau_name_desc', 'Full name for display purposes')}
      />

      <Select
        label={t('admin_qau_role', 'Role')}
        data={[
          { value: 'subscriber', label: t('admin_qau_role_viewer', '👁 Viewer - Can view granted campaigns') },
          { value: 'wpsg_editor', label: t('admin_qau_role_editor', '⚙️ Gallery Editor - Can manage this plugin') },
        ]}
        value={quickAddRole}
        onChange={(value) => setQuickAddRole(value ?? 'subscriber')}
        description={t('admin_qau_role_desc', 'WordPress role determines plugin permissions')}
      />

      <Select
        label={t('admin_qau_grant', 'Grant Access To (optional)')}
        placeholder={t('admin_qau_no_access', 'No initial access')}
        data={[
          { value: '', label: t('admin_qau_no_access', 'No initial access') },
          ...activeCampaigns.map((campaign) => ({
            value: campaign.id,
            label: campaign.companyId ? `${campaign.title} (${campaign.companyId})` : campaign.title,
          })),
        ]}
        value={quickAddCampaignId}
        onChange={(value) => setQuickAddCampaignId(value ?? '')}
        clearable
      />

      <Checkbox
        label={t('admin_qau_test_mode', '🧪 Test mode: Simulate email failure')}
        checked={quickAddTestMode}
        onChange={(e) => setQuickAddTestMode(e.currentTarget.checked)}
        description={t('admin_qau_test_mode_desc', 'Enable to test the password reset link UI without actually sending email')}
      />

      <Group {...getWpsgDebugProps('QuickAddUserModal', 'actions')} justify="flex-end" mt="md" wrap="wrap" gap="sm">
        <Button variant="default" onClick={onClose}>{t('admin_qau_cancel', 'Cancel')}</Button>
        <Button
          onClick={onSubmit}
          loading={quickAddSaving}
          disabled={!quickAddEmail || !quickAddName}
          leftSection={<IconUserPlus size={16} />}
        >
          {t('admin_qau_create', 'Create User')}
        </Button>
      </Group>
    </>
  );
}

setWpsgDebugDisplayName(QuickAddUserFormState, 'AdminPanel:QuickAddUserModal:FormState');

export function QuickAddUserModal({
  opened,
  onClose,
  quickAddResult,
  quickAddEmail,
  setQuickAddEmail,
  quickAddName,
  setQuickAddName,
  quickAddRole,
  setQuickAddRole,
  quickAddCampaignId,
  setQuickAddCampaignId,
  quickAddTestMode,
  setQuickAddTestMode,
  campaigns,
  onSubmit,
  quickAddSaving,
  onNotify,
}: QuickAddUserModalProps) {
  const { t } = useTranslation('wpsg');
  const activeCampaigns = campaigns.filter((c) => c.status === 'active');

  return (
    <Modal
      {...getWpsgDebugProps('QuickAddUserModal')}
      opened={opened}
      onClose={onClose}
      title={<span {...getWpsgDebugProps('QuickAddUserModal', 'title')}>{t('admin_qau_title', 'Quick Add User')}</span>}
      size="md"
      padding="md"
      closeButtonProps={getWpsgDebugProps('QuickAddUserModal', 'close')}
      overlayProps={getWpsgDebugProps('QuickAddUserModal', 'overlay')}
    >
      <Stack {...getWpsgDebugProps('QuickAddUserModal', 'stack')} gap="md">
        {quickAddResult ? (
          <QuickAddUserSuccessState
            quickAddResult={quickAddResult}
            onClose={onClose}
            onNotify={onNotify}
          />
        ) : (
          <QuickAddUserFormState
            quickAddEmail={quickAddEmail}
            setQuickAddEmail={setQuickAddEmail}
            quickAddName={quickAddName}
            setQuickAddName={setQuickAddName}
            quickAddRole={quickAddRole}
            setQuickAddRole={setQuickAddRole}
            quickAddCampaignId={quickAddCampaignId}
            setQuickAddCampaignId={setQuickAddCampaignId}
            quickAddTestMode={quickAddTestMode}
            setQuickAddTestMode={setQuickAddTestMode}
            activeCampaigns={activeCampaigns}
            onSubmit={onSubmit}
            onClose={onClose}
            quickAddSaving={quickAddSaving}
          />
        )}
      </Stack>
    </Modal>
  );
}

setWpsgDebugDisplayName(QuickAddUserModal, 'AdminPanel:QuickAddUserModal');