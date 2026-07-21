import { Component, type ReactNode } from 'react';
import i18n from 'i18next';
import { Alert, Button, Stack, Text } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { isDebugEnabled } from '../utils/debug';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
  /**
   * P69-C/D: when true (an admin/editor viewer), the raw exception message is
   * shown for troubleshooting. Public visitors (default) see generic copy so
   * internal details in error messages aren't disclosed. The `wpsg_debug`
   * localStorage flag also reveals the raw message regardless of this prop.
   */
  isAdmin?: boolean;
}

interface State {
  hasError: boolean;
  error?: Error | undefined;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    void import('@sentry/react').then((Sentry) => {
      Sentry.captureException(error, {
        contexts: { react: { componentStack: errorInfo.componentStack ?? '' } },
      });
    }).catch(() => {
      // Ignore monitoring failures; the boundary itself must stay resilient.
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const genericBody = i18n.t('eb_error_body', 'An unexpected error occurred while loading this component.');
      // Only reveal the raw exception message to admins/editors, or when the
      // wpsg_debug flag is set. Public visitors get the generic copy — the full
      // error already reaches Sentry (see componentDidCatch); end users don't
      // need internal details (URLs, state fragments) that a message may carry.
      const showRawMessage = this.props.isAdmin === true || isDebugEnabled();

      return (
        <Alert
          color="red"
          title={i18n.t('eb_error_title', 'Something went wrong')}
          icon={<IconAlertTriangle />}
          role="alert"
        >
          <Stack gap="sm">
            <Text size="sm">
              {showRawMessage ? (this.state.error?.message || genericBody) : genericBody}
            </Text>
            <Button
              size="xs"
              variant="light"
              onClick={this.handleReset}
              aria-label={i18n.t('eb_retry_aria', 'Reset error boundary and try again')}
            >
              {i18n.t('eb_try_again', 'Try Again')}
            </Button>
          </Stack>
        </Alert>
      );
    }

    return this.props.children;
  }
}
