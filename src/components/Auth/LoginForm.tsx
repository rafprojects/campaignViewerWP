import { useState } from 'react';
import { TextInput, PasswordInput, Button, Paper, Title, Text, Stack, Alert } from '@mantine/core';
import { useForm } from '@mantine/form';
import { getWpsgDebugProps, setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

interface LoginFormProps {
  onSubmit: (email: string, password: string) => Promise<void>;
  compact?: boolean;
  minPasswordLength?: number | undefined;
}

export function LoginForm({ onSubmit, compact = false, minPasswordLength = 6 }: LoginFormProps) {
  const form = useForm({
    initialValues: {
      email: '',
      password: '',
    },
    validate: {
      email: (value: string) => (/^\S+@\S+\.\S+$/.test(value) ? null : 'Enter a valid email'),
      password: (value: string) =>
        value.trim().length >= minPasswordLength
          ? null
          : `Password must be at least ${minPasswordLength} character${minPasswordLength === 1 ? '' : 's'}`,
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
        setError('Login failed. Check your credentials.');
      }
    } finally {
      setIsSubmitting(false);
    }
  });

  const content = (
    <Stack gap="lg">
      {!compact && (
        <Stack gap="xs">
          <Title order={2} size="h4">Sign in</Title>
          <Text c="dimmed" size="sm">
            Access private campaigns with your WordPress account.
          </Text>
        </Stack>
      )}

      <TextInput
        label="Email"
        type="email"
        placeholder="you@example.com"
        required
        {...form.getInputProps('email')}
      />

      <PasswordInput
        label="Password"
        placeholder="Enter your password"
        required
        {...form.getInputProps('password')}
      />

      {error && (
        <Alert color="red" title="Error" role="alert" aria-live="assertive">
          {error}
        </Alert>
      )}

      <Button type="submit" loading={isSubmitting} fullWidth>
        {isSubmitting ? 'Signing in...' : 'Sign in'}
      </Button>
    </Stack>
  );

  if (compact) {
    return (
      <form {...getWpsgDebugProps('LoginForm')} onSubmit={handleSubmit}>
        {content}
      </form>
    );
  }

  return (
    <Paper
      {...getWpsgDebugProps('LoginForm')}
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

setWpsgDebugDisplayName(LoginForm, 'LoginForm');