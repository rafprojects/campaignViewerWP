import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TextInput, PasswordInput, Button, Paper, Title, Text, Stack, Alert } from '@mantine/core';
import { useForm } from '@mantine/form';

interface LoginFormProps {
  onSubmit: (email: string, password: string) => Promise<void>;
  compact?: boolean;
  minPasswordLength?: number | undefined;
}

export function LoginForm({ onSubmit, compact = false, minPasswordLength = 6 }: LoginFormProps) {
  const { t } = useTranslation('wpsg');
  const form = useForm({
    initialValues: {
      email: '',
      password: '',
    },
    validate: {
      email: (value: string) => (/^\S+@\S+\.\S+$/.test(value) ? null : t('login_email_error', 'Enter a valid email')),
      password: (value: string) =>
        value.trim().length >= minPasswordLength
          ? null
          : t('login_password_error', `Password must be at least ${minPasswordLength} character${minPasswordLength === 1 ? '' : 's'}`, { count: minPasswordLength }),
    },
  });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = form.onSubmit(async (values) => {
    setError(null);
    setIsSubmitting(true);
    try {
      await onSubmit(values.email, values.password);
    } catch (err) {
      if (err instanceof Error && err.message) {
        setError(err.message);
      } else {
        setError(t('login_error_generic', 'Login failed. Check your credentials.'));
      }
    } finally {
      setIsSubmitting(false);
    }
  });

  const content = (
    <Stack gap="lg">
      {!compact && (
        <Stack gap="xs">
          <Title order={2} size="h4">{t('login_title', 'Sign in')}</Title>
          <Text c="dimmed" size="sm">
            {t('login_subtitle', 'Access private campaigns with your WordPress account.')}
          </Text>
        </Stack>
      )}

      <TextInput
        label={t('login_email_label', 'Email')}
        type="email"
        placeholder={t('login_email_placeholder', 'you@example.com')}
        required
        {...form.getInputProps('email')}
      />

      <PasswordInput
        label={t('login_password_label', 'Password')}
        placeholder={t('login_password_placeholder', 'Enter your password')}
        required
        {...form.getInputProps('password')}
      />

      {error && (
        <Alert color="red" title={t('login_error_title', 'Error')} role="alert" aria-live="assertive">
          {error}
        </Alert>
      )}

      <Button type="submit" loading={isSubmitting} fullWidth>
        {isSubmitting ? t('login_submitting', 'Signing in...') : t('login_submit', 'Sign in')}
      </Button>
    </Stack>
  );

  if (compact) {
    return (
      <form onSubmit={handleSubmit}>
        {content}
      </form>
    );
  }

  return (
    <Paper
      p="xl"
      radius="md"
      withBorder
      component="form"
      onSubmit={handleSubmit}
      maw={26 * 16}
      mx="auto"
      my="xl"
    >
      {content}
    </Paper>
  );
}

LoginForm.displayName = 'LoginForm';
