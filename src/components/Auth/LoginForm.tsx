import { useState } from 'react';
import { TextInput, PasswordInput, Button, Paper, Title, Text, Stack, Alert } from '@mantine/core';

interface LoginFormProps {
  onSubmit: (email: string, password: string) => Promise<void>;
}

export function LoginForm({ onSubmit }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await onSubmit(email, password);
    } catch (err) {
      if (err instanceof Error && err.message) {
        setError(err.message);
      } else {
        setError('Login failed. Check your credentials.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

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
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          placeholder="you@example.com"
        />

        <PasswordInput
          label="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          placeholder="Enter your password"
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
