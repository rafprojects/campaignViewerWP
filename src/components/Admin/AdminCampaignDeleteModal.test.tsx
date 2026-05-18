import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@/test/test-utils';
import { AdminCampaignDeleteModal } from './AdminCampaignDeleteModal';

describe('AdminCampaignDeleteModal', () => {
  it('renders title and disables the confirm button until DELETE is typed', () => {
    render(
      <AdminCampaignDeleteModal
        opened={true}
        campaign={{ id: '1', title: 'Summer Sale' }}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByText('Delete campaign')).toBeInTheDocument();
    const confirmBtn = screen.getByRole('button', { name: /delete campaign summer sale/i });
    expect(confirmBtn).toBeDisabled();
  });

  it('enables the confirm button only after typing DELETE and passes purgeAnalytics', () => {
    const onConfirm = vi.fn();
    render(
      <AdminCampaignDeleteModal
        opened={true}
        campaign={{ id: '1', title: 'Summer Sale' }}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    const input = screen.getByLabelText('Type DELETE to confirm');
    const confirmBtn = screen.getByRole('button', { name: /delete campaign summer sale/i });

    fireEvent.change(input, { target: { value: 'delete' } });
    expect(confirmBtn).toBeDisabled();

    fireEvent.change(input, { target: { value: 'DELETE' } });
    expect(confirmBtn).not.toBeDisabled();

    const purgeCheckbox = screen.getByLabelText(/purge analytics events/i);
    fireEvent.click(purgeCheckbox);

    fireEvent.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalledWith({ purgeAnalytics: true });
  });

  it('renders with null campaign without crashing', () => {
    expect(() =>
      render(
        <AdminCampaignDeleteModal
          opened={true}
          campaign={null}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
        />,
      ),
    ).not.toThrow();
  });
});
