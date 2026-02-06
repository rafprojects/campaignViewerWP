import { Container, Group, Button, Tooltip, ActionIcon, Text } from '@mantine/core';
import { IconSettings } from '@tabler/icons-react';

interface AuthBarProps {
  email: string;
  isAdmin: boolean;
  onOpenAdminPanel: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
}

export function AuthBar({
  email,
  isAdmin,
  onOpenAdminPanel,
  onOpenSettings,
  onLogout,
}: AuthBarProps) {
  return (
    <Container size="xl" py="sm">
      <Group justify="space-between" wrap="wrap" gap="sm">
        <Text size="sm">Signed in as {email}</Text>
        <Group gap="sm" wrap="wrap">
          {isAdmin && (
            <>
              <Button
                variant="default"
                onClick={onOpenAdminPanel}
                className="wpsg-admin-btn"
                size="sm"
              >
                Admin Panel
              </Button>
              <Tooltip label="Settings">
                <ActionIcon
                  variant="default"
                  size="lg"
                  className="wpsg-admin-btn"
                  onClick={onOpenSettings}
                  aria-label="Settings"
                >
                  <IconSettings size={20} />
                </ActionIcon>
              </Tooltip>
            </>
          )}
          <Button
            variant="subtle"
            onClick={onLogout}
            size="sm"
          >
            Sign out
          </Button>
        </Group>
      </Group>
    </Container>
  );
}
