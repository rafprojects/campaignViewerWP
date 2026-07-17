import { useState } from 'react';
import type { FormEvent } from 'react';
import { Box, Button, Text, TextInput, Stack, Alert } from '@mantine/core';
import { IconMail, IconCheck, IconAlertCircle } from '@tabler/icons-react';
import { Trans, useTranslation } from 'react-i18next';
import type { ApiClient } from '@/services/apiClient';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

interface RequestAccessFormProps {
  campaignId: string;
  campaignTitle: string;
  apiClient: ApiClient;
}

type SubmitState = 'idle' | 'loading' | 'success' | 'error';

export function RequestAccessForm({ campaignId, campaignTitle, apiClient }: RequestAccessFormProps) {
  const { t } = useTranslation('wpsg');
  const [email, setEmail] = useState('');
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitState('loading');
    setErrorMessage('');

    try {
      await apiClient.submitAccessRequest(campaignId, email.trim());
      setSubmitState('success');
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : t('raf_error_generic', 'Failed to submit request. Please try again.');
      setErrorMessage(msg);
      setSubmitState('error');
    }
  };

  if (submitState === 'success') {
    return (
      <Box
        p="md"
        style={{
          background: 'color-mix(in srgb, var(--wpsg-color-surface) 95%, transparent)',
          borderRadius: 8,
          border: '1px solid var(--wpsg-color-border, rgba(255,255,255,0.15))',
          textAlign: 'center',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <IconCheck size={24} color="var(--mantine-color-green-4)" />
        <Text size="sm" mt={6} c="dimmed">
          {/* P64-C: no confirmation email is sent on submit anymore (that was a
              mail-bombing vector on this public endpoint); the requester hears
              back only once an admin resolves the request. */}
          {t('raf_check_email', 'Request submitted. You will receive an email once an administrator reviews it.')}
        </Text>
      </Box>
    );
  }

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      p="md"
      style={{
        background: 'color-mix(in srgb, var(--wpsg-color-surface) 95%, transparent)',
        borderRadius: 8,
        border: '1px solid var(--wpsg-color-border, rgba(255,255,255,0.15))',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <Stack gap="xs">
        <Text size="xs" fw={500} ta="center" c="dimmed">
          <Trans
            i18nKey="raf_request_to"
            values={{ title: campaignTitle }}
            components={{ strong: <Text component="span" fw={700} inherit /> }}
            defaults="Request access to <strong>{{title}}</strong>"
          />
        </Text>

        {submitState === 'error' && (
          <Alert
            icon={<IconAlertCircle size={14} />}
            color="red"
            variant="light"
            p="xs"
          >
            <Text size="xs">{errorMessage}</Text>
          </Alert>
        )}

        <TextInput
          placeholder={t('raf_email_ph', 'your@email.com')}
          value={email}
          onChange={(e) => setEmail(e.currentTarget.value)}
          type="email"
          required
          size="xs"
          leftSection={<IconMail size={14} />}
          aria-label={t('raf_email_aria', 'Email address')}
          disabled={submitState === 'loading'}
          styles={{
            input: {
              background: 'var(--mantine-color-default)',
              color: 'var(--mantine-color-text)',
              borderColor: 'var(--mantine-color-default-border)',
            },
          }}
        />

        <Button
          type="submit"
          size="xs"
          variant="filled"
          loading={submitState === 'loading'}
          fullWidth
        >
          {t('raf_request_access', 'Request Access')}
        </Button>
      </Stack>
    </Box>
  );
}

setWpsgDebugDisplayName(RequestAccessForm, 'RequestAccessForm');