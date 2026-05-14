import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@/test/test-utils';
import { AuthBar } from './AuthBar';

const baseProps = {
	email: 'user@example.com',
	isAdmin: false,
	onOpenAdminPanel: vi.fn(),
	onOpenSettings: vi.fn(),
	onLogout: vi.fn(),
};

describe('AuthBar', () => {
	it('renders in floating mode without crashing', () => {
		const { container } = render(
			<AuthBar {...baseProps} displayMode="floating" isAuthenticated={true} />,
		);
		expect(container.firstChild).toBeTruthy();
	});

	it('renders in minimal mode without crashing', () => {
		const { container } = render(
			<AuthBar {...baseProps} displayMode="minimal" isAuthenticated={true} />,
		);
		expect(container.firstChild).toBeTruthy();
	});

	it('renders in sticky mode without crashing', () => {
		const { container } = render(
			<AuthBar {...baseProps} displayMode="sticky" isAuthenticated={true} />,
		);
		expect(container.firstChild).toBeTruthy();
	});

	it('renders sign-in state when unauthenticated', () => {
		render(
			<AuthBar
				{...baseProps}
				isAuthenticated={false}
				displayMode="minimal"
				onOpenSignIn={vi.fn()}
			/>,
		);
		expect(screen.getByRole('button', { name: /sign in/i })).toBeDefined();
	});
});
