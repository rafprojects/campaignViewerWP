import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '../test/test-utils';
import { Table } from '@mantine/core';
import { useAccessRows } from './useAccessRows';
import type { CompanyAccessGrant } from '@/services/adminQuery';

// Helper component that renders the hook output inside a Table.
function TestRows({
  entries,
  viewMode = 'campaign',
  onRevokeAccess = vi.fn(),
}: {
  entries: CompanyAccessGrant[];
  viewMode?: 'campaign' | 'company' | 'all';
  onRevokeAccess?: (entry: CompanyAccessGrant) => Promise<void>;
}) {
  const rows = useAccessRows({
    accessEntries: entries,
    accessViewMode: viewMode,
    onRevokeAccess,
  });
  return (
    <Table>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>User</Table.Th>
          <Table.Th>Access Type</Table.Th>
          <Table.Th>Role</Table.Th>
          <Table.Th>Granted / Expires</Table.Th>
          <Table.Th>Revoke</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>{rows}</Table.Tbody>
    </Table>
  );
}

const baseEntry: CompanyAccessGrant = {
  userId: 1,
  source: 'campaign',
  grantedAt: '2026-01-01T00:00:00.000Z',
  user: { displayName: 'Alice', email: 'alice@example.com' },
};

const roleBadge = (name = 'Alice') => screen.getByLabelText(`Role for ${name}`);

// P75-I: the role column is a read-only badge. P51-H shipped an editable
// dropdown here, but P53-D had already reduced every grant endpoint's
// access_level enum to ['viewer'] — so picking Editor or Owner POSTed a level
// the server rejects with "Invalid parameter(s): access_level".
describe('useAccessRows — P75-I read-only role badge', () => {
  it('renders the current role for a viewer-level grant', () => {
    render(<TestRows entries={[{ ...baseEntry, access_level: 'viewer' }]} />);
    expect(roleBadge()).toHaveTextContent(/viewer/i);
  });

  it('still shows a legacy editor-level grant at its stored level', () => {
    render(<TestRows entries={[{ ...baseEntry, access_level: 'editor' }]} />);
    expect(roleBadge()).toHaveTextContent(/editor/i);
  });

  it('still shows a legacy owner-level grant at its stored level', () => {
    render(<TestRows entries={[{ ...baseEntry, access_level: 'owner' }]} />);
    expect(roleBadge()).toHaveTextContent(/owner/i);
  });

  it('defaults to viewer when access_level is absent (legacy grant)', () => {
    const legacyEntry: CompanyAccessGrant = { ...baseEntry };
    delete legacyEntry.access_level;
    render(<TestRows entries={[legacyEntry]} />);
    expect(roleBadge()).toHaveTextContent(/viewer/i);
  });

  it('exposes an accessible label per row', () => {
    render(<TestRows entries={[{ ...baseEntry, access_level: 'viewer' }]} />);
    expect(roleBadge()).toBeInTheDocument();
  });

  it('offers no role control to change — the level is not selectable', () => {
    render(<TestRows entries={[{ ...baseEntry, access_level: 'viewer' }]} />);

    expect(screen.queryByRole('textbox', { name: /role for/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /role for/i })).not.toBeInTheDocument();
    fireEvent.click(roleBadge());
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
  });

  it('renders a row with company source badge', () => {
    render(
      <TestRows entries={[{ ...baseEntry, source: 'company', access_level: 'viewer' }]} />,
    );
    expect(screen.getByText(/company/i)).toBeInTheDocument();
  });

  it('renders the revoke action icon for each row', () => {
    render(<TestRows entries={[{ ...baseEntry, access_level: 'viewer' }]} />);
    expect(screen.getByRole('button', { name: /revoke access/i })).toBeInTheDocument();
  });

  it('shows expired styling when is_expired is true', () => {
    render(
      <TestRows
        entries={[{
          ...baseEntry,
          access_level: 'viewer',
          expires_at: '2020-01-01T00:00:00.000Z',
          is_expired: true,
        }]}
      />,
    );
    expect(screen.getByText(/expired/i)).toBeInTheDocument();
  });

  it('renders distinct role badges across multiple rows', () => {
    render(
      <TestRows
        entries={[
          { ...baseEntry, userId: 1, access_level: 'viewer' },
          { ...baseEntry, userId: 2, user: { displayName: 'Bob', email: 'bob@x.com' }, access_level: 'editor' },
          { ...baseEntry, userId: 3, user: { displayName: 'Carol', email: 'carol@x.com' }, access_level: 'owner' },
        ]}
      />,
    );
    expect(roleBadge('Alice')).toHaveTextContent(/viewer/i);
    expect(roleBadge('Bob')).toHaveTextContent(/editor/i);
    expect(roleBadge('Carol')).toHaveTextContent(/owner/i);
  });
});

// P64-B: revoke must be confirmed, and the confirmation copy must state the
// actual outcome — which differs for a company-sourced grant by view mode.
describe('useAccessRows — P64-B revoke confirmation', () => {
  const revokeButton = () => screen.getByRole('button', { name: /revoke access/i });

  it('does not revoke immediately on click — it opens a confirm dialog first', async () => {
    const onRevokeAccess = vi.fn().mockResolvedValue(undefined);
    render(<TestRows entries={[{ ...baseEntry, source: 'campaign' }]} onRevokeAccess={onRevokeAccess} />);

    fireEvent.click(revokeButton());

    // A dialog appears; nothing revoked yet.
    expect(await screen.findByText(/revoke access\?/i)).toBeInTheDocument();
    expect(onRevokeAccess).not.toHaveBeenCalled();
  });

  it('cancelling the dialog does not call onRevokeAccess', async () => {
    const onRevokeAccess = vi.fn().mockResolvedValue(undefined);
    render(<TestRows entries={[{ ...baseEntry, source: 'campaign' }]} onRevokeAccess={onRevokeAccess} />);

    fireEvent.click(revokeButton());
    await screen.findByText(/revoke access\?/i);
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));

    expect(onRevokeAccess).not.toHaveBeenCalled();
  });

  it('confirming the dialog calls onRevokeAccess with the entry', async () => {
    const onRevokeAccess = vi.fn().mockResolvedValue(undefined);
    render(<TestRows entries={[{ ...baseEntry, source: 'campaign' }]} onRevokeAccess={onRevokeAccess} />);

    fireEvent.click(revokeButton());
    await screen.findByText(/revoke access\?/i);
    fireEvent.click(screen.getByRole('button', { name: /^revoke$/i }));

    expect(onRevokeAccess).toHaveBeenCalledTimes(1);
    expect(onRevokeAccess).toHaveBeenCalledWith(expect.objectContaining({ userId: 1, source: 'campaign' }));
  });

  it('company-sourced entry in CAMPAIGN view: copy says block-this-campaign-only', async () => {
    render(
      <TestRows
        viewMode="campaign"
        entries={[{ ...baseEntry, source: 'company', companyName: 'Acme' }]}
      />,
    );
    fireEvent.click(revokeButton());

    expect(await screen.findByText(/block on this campaign\?/i)).toBeInTheDocument();
    expect(screen.getByText(/access to other Acme campaigns is kept/i)).toBeInTheDocument();
    // Confirm button reflects the block-only action, not a company-wide revoke.
    expect(screen.getByRole('button', { name: /block on this campaign/i })).toBeInTheDocument();
  });

  it('company-sourced entry in COMPANY view: copy says revoke company-wide', async () => {
    render(
      <TestRows
        viewMode="company"
        entries={[{ ...baseEntry, source: 'company', companyName: 'Acme' }]}
      />,
    );
    fireEvent.click(revokeButton());

    expect(await screen.findByText(/revoke company-wide access\?/i)).toBeInTheDocument();
    expect(screen.getByText(/across ALL campaigns of Acme/i)).toBeInTheDocument();
  });
});
