/**
 * P18-QA: ErrorBoundary component tests.
 *
 * Covers:
 * - Renders children when no error
 * - Catches errors via getDerivedStateFromError
 * - Shows default error UI with message
 * - Try Again button calls handleReset and clears state
 * - Custom fallback prop renders instead of default UI
 * - onReset callback is invoked on reset
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@/test/test-utils';
import '@testing-library/jest-dom/vitest';

import { ErrorBoundary } from './ErrorBoundary';

// ─── Helper: a component that throws when told to ────────────────────────────

function Bomb({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test explosion');
  }
  return <div>Safe content</div>;
}

// Suppress React's error output to keep test output clean
const suppressConsoleError = () => {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
  return spy;
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ErrorBoundary', () => {
  it('renders children normally when no error is thrown', () => {
    render(
      <ErrorBoundary>
        <div>Hello World</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('catches a render error and shows default error UI', () => {
    const spy = suppressConsoleError();
    render(
      <ErrorBoundary>
        <Bomb shouldThrow />
      </ErrorBoundary>,
    );
    spy.mockRestore();

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.getByText(/Test explosion/)).toBeInTheDocument();
  });

  it('shows the error message from the thrown Error', () => {
    const spy = suppressConsoleError();
    render(
      <ErrorBoundary>
        <Bomb shouldThrow />
      </ErrorBoundary>,
    );
    spy.mockRestore();

    expect(screen.getByText(/Test explosion/)).toBeInTheDocument();
  });

  it('shows "Try Again" button in default error UI', () => {
    const spy = suppressConsoleError();
    render(
      <ErrorBoundary>
        <Bomb shouldThrow />
      </ErrorBoundary>,
    );
    spy.mockRestore();

    const btn = screen.getByRole('button', { name: /try again/i });
    expect(btn).toBeInTheDocument();
  });

  it('"Try Again" button resets the error state', () => {
    const spy = suppressConsoleError();

    // We need a way to toggle shouldThrow off after the reset
    let throwFlag = true;
    function ToggleBomb() {
      if (throwFlag) throw new Error('Toggle error');
      return <div>Recovered</div>;
    }

    const { rerender } = render(
      <ErrorBoundary>
        <ToggleBomb />
      </ErrorBoundary>,
    );
    spy.mockRestore();

    expect(screen.getByRole('alert')).toBeInTheDocument();

    throwFlag = false;
    const btn = screen.getByRole('button', { name: /try again/i });
    fireEvent.click(btn);

    rerender(
      <ErrorBoundary>
        <ToggleBomb />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Recovered')).toBeInTheDocument();
  });

  it('calls onReset callback when Try Again is clicked', () => {
    const spy = suppressConsoleError();
    const onReset = vi.fn();
    let throwFlag = true;

    function ResettableBomb() {
      if (throwFlag) {
        throw new Error('Test explosion');
      }

      return <div>Recovered after reset</div>;
    }

    const { rerender } = render(
      <ErrorBoundary onReset={onReset}>
        <ResettableBomb />
      </ErrorBoundary>,
    );

    const btn = screen.getByRole('button', { name: /try again/i });
    throwFlag = false;
    fireEvent.click(btn);

    rerender(
      <ErrorBoundary onReset={onReset}>
        <ResettableBomb />
      </ErrorBoundary>,
    );

    spy.mockRestore();

    expect(onReset).toHaveBeenCalledOnce();
    expect(screen.getByText('Recovered after reset')).toBeInTheDocument();
  });

  it('renders custom fallback when fallback prop is provided', () => {
    const spy = suppressConsoleError();
    render(
      <ErrorBoundary fallback={<div>Custom fallback UI</div>}>
        <Bomb shouldThrow />
      </ErrorBoundary>,
    );
    spy.mockRestore();

    expect(screen.getByText('Custom fallback UI')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('does NOT render children after an error', () => {
    const spy = suppressConsoleError();
    render(
      <ErrorBoundary>
        <Bomb shouldThrow />
      </ErrorBoundary>,
    );
    spy.mockRestore();

    expect(screen.queryByText('Safe content')).not.toBeInTheDocument();
  });

  it('renders fallback message for errors without a message', () => {
    const spy = suppressConsoleError();

    function SilentThrow() {
      // Throw an Error with an empty message
      throw new Error();
    }

    render(
      <ErrorBoundary>
        <SilentThrow />
      </ErrorBoundary>,
    );
    spy.mockRestore();

    expect(
      screen.getByText(/An unexpected error occurred while loading this component/i),
    ).toBeInTheDocument();
  });
});
