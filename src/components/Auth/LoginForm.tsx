import { useState } from 'react';
import { TextInput, PasswordInput, Button, Paper, Title, Text, Stack, Alert } from '@mantine/core';
import { useForm } from '@mantine/form';

interface LoginFormProps {
  onSubmit: (email: string, password: string) => Promise<void>;
}

export function LoginForm({ onSubmit }: LoginFormProps) {
  const form = useForm({
    initialValues: {
      email: '',
      password: '',
    },
    validate: {
      email: (value: string) => (/^\S+@\S+\.\S+$/.test(value) ? null : 'Enter a valid email'),
      password: (value: string) => (value.trim().length >= 6 ? null : 'Password must be at least 6 characters'),
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
      <Stack gap="lg">
        <Stack gap="xs">
          <Title order={2} size="h4">Sign in</Title>
          <Text c="dimmed" size="sm">
            Access private campaigns with your WordPress account.
          </Text>
        </Stack>

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
          <Alert color="red" title="Error">
            {error}
          </Alert>
        )}

        <Button type="submit" loading={isSubmitting} fullWidth>
          {isSubmitting ? 'Signing in...' : 'Sign in'}
        </Button>
      </Stack>
    </Paper>
  );
}
