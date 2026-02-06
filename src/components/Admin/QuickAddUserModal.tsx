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

type AdminCampaign = {
  id: string;
  title: string;
  companyId: string;
  status: string;
};

type QuickAddResult = {
  success: boolean;
  message: string;
  resetUrl?: string;
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
  const activeCampaigns = campaigns.filter((c) => c.status === 'active');

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Quick Add User"
      size="md"
      padding="md"
    >
      <Stack gap="md">
        {quickAddResult ? (
          <>
            <Alert
              color={quickAddResult.success ? 'teal' : 'red'}
              title={quickAddResult.success ? 'Success' : 'Error'}
              role={quickAddResult.success ? 'status' : 'alert'}
              aria-live={quickAddResult.success ? 'polite' : 'assertive'}
            >
              <Text size="sm">{quickAddResult.message}</Text>
              {quickAddResult.resetUrl && (
                <Box mt="sm">
                  <Text size="sm" fw={500}>Password Reset Link:</Text>
                  <TextInput
                    label="Password reset link"
                    value={quickAddResult.resetUrl}
                    readOnly
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                    rightSection={(
                      <Tooltip label="Click to select">
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
                      Open Reset Link
                    </Button>
                    <Button
                      size="xs"
                      variant="subtle"
                      onClick={() => {
                        navigator.clipboard.writeText(quickAddResult.resetUrl!);
                        onNotify({ type: 'success', text: 'Reset URL copied to clipboard' });
                      }}
                    >
                      Copy Link
                    </Button>
                  </Group>
                  <Text size="xs" c="dimmed" mt="xs">
                    Share this link securely with the user. They can use it to set their own password.
                  </Text>
                </Box>
              )}
            </Alert>
            <Group justify="flex-end" wrap="wrap" gap="sm">
              <Button onClick={onClose}>Close</Button>
            </Group>
          </>
        ) : (
          <>
            <TextInput
              label="Email"
              placeholder="user@example.com"
              required
              value={quickAddEmail}
              onChange={(e) => setQuickAddEmail(e.currentTarget.value)}
              description="User's WordPress login email address"
            />

            <TextInput
              label="Display Name"
              placeholder="John Doe"
              required
              value={quickAddName}
              onChange={(e) => setQuickAddName(e.currentTarget.value)}
              description="Full name for display purposes"
            />

            <Select
              label="Role"
              data={[
                { value: 'subscriber', label: '👁 Viewer - Can view granted campaigns' },
                { value: 'wpsg_admin', label: '⚙️ Gallery Admin - Can manage this plugin' },
              ]}
              value={quickAddRole}
              onChange={(v) => setQuickAddRole(v ?? 'subscriber')}
              description="WordPress role determines plugin permissions"
            />

            <Select
              label="Grant Access To (optional)"
              placeholder="No initial access"
              data={[
                { value: '', label: 'No initial access' },
                ...activeCampaigns.map((c) => ({
                  value: c.id,
                  label: c.companyId ? `${c.title} (${c.companyId})` : c.title,
                })),
              ]}
              value={quickAddCampaignId}
              onChange={(v) => setQuickAddCampaignId(v ?? '')}
              clearable
            />

            <Checkbox
              label="🧪 Test mode: Simulate email failure"
              checked={quickAddTestMode}
              onChange={(e) => setQuickAddTestMode(e.currentTarget.checked)}
              description="Enable to test the password reset link UI without actually sending email"
            />

            <Group justify="flex-end" mt="md" wrap="wrap" gap="sm">
              <Button variant="default" onClick={onClose}>Cancel</Button>
              <Button
                onClick={onSubmit}
                loading={quickAddSaving}
                disabled={!quickAddEmail || !quickAddName}
                leftSection={<IconUserPlus size={16} />}
              >
                Create User
              </Button>
            </Group>
          </>
        )}
      </Stack>
    </Modal>
  );
}
