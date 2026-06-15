import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '../test/test-utils';
import { Table } from '@mantine/core';
import { useAccessRows } from './useAccessRows';
import type { CompanyAccessGrant } from '@/services/adminQuery';
import type { CampaignAccessLevel } from '@/types';

// Helper component that renders the hook output inside a Table.
function TestRows({
  entries,
  viewMode = 'campaign',
  onChangeRole = vi.fn(),
}: {
  entries: CompanyAccessGrant[];
  viewMode?: 'campaign' | 'company' | 'all';
  onChangeRole?: (entry: CompanyAccessGrant, level: CampaignAccessLevel) => Promise<void>;
}) {
  const rows = useAccessRows({
    accessEntries: entries,
    accessViewMode: viewMode,
    onRevokeAccess: vi.fn(),
    onChangeRole,
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

const roleInput = (name = 'Alice') =>
  screen.getByLabelText(`Role for ${name}`, { selector: 'input' }) as HTMLInputElement;

describe('useAccessRows — P51-H role dropdown', () => {
  it('renders the current role in the dropdown for a viewer-level grant', () => {
    render(<TestRows entries={[{ ...baseEntry, access_level: 'viewer' }]} />);
    expect(roleInput().value).toMatch(/viewer/i);
  });

  it('renders the current role in the dropdown for an editor-level grant', () => {
    render(<TestRows entries={[{ ...baseEntry, access_level: 'editor' }]} />);
    expect(roleInput().value).toMatch(/editor/i);
  });

  it('renders the current role in the dropdown for an owner-level grant', () => {
    render(<TestRows entries={[{ ...baseEntry, access_level: 'owner' }]} />);
    expect(roleInput().value).toMatch(/owner/i);
  });

  it('defaults to viewer when access_level is absent (legacy grant)', () => {
    const legacyEntry: CompanyAccessGrant = { ...baseEntry };
    delete legacyEntry.access_level;
    render(<TestRows entries={[legacyEntry]} />);
    expect(roleInput().value).toMatch(/viewer/i);
  });

  it('exposes an accessible label per row', () => {
    render(<TestRows entries={[{ ...baseEntry, access_level: 'viewer' }]} />);
    expect(roleInput()).toBeInTheDocument();
  });

  it('calls onChangeRole with the new level when a different option is picked', () => {
    const onChangeRole = vi.fn().mockResolvedValue(undefined);
    render(<TestRows entries={[{ ...baseEntry, access_level: 'viewer' }]} onChangeRole={onChangeRole} />);

    fireEvent.click(roleInput());
    fireEvent.click(screen.getByRole('option', { name: /owner/i }));

    expect(onChangeRole).toHaveBeenCalledTimes(1);
    expect(onChangeRole).toHaveBeenCalledWith(expect.objectContaining({ userId: 1 }), 'owner');
  });

  it('does not call onChangeRole when the same role is re-selected', () => {
    const onChangeRole = vi.fn().mockResolvedValue(undefined);
    render(<TestRows entries={[{ ...baseEntry, access_level: 'viewer' }]} onChangeRole={onChangeRole} />);

    fireEvent.click(roleInput());
    fireEvent.click(screen.getByRole('option', { name: /viewer/i }));

    expect(onChangeRole).not.toHaveBeenCalled();
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

  it('renders distinct role dropdowns across multiple rows', () => {
    render(
      <TestRows
        entries={[
          { ...baseEntry, userId: 1, access_level: 'viewer' },
          { ...baseEntry, userId: 2, user: { displayName: 'Bob', email: 'bob@x.com' }, access_level: 'editor' },
          { ...baseEntry, userId: 3, user: { displayName: 'Carol', email: 'carol@x.com' }, access_level: 'owner' },
        ]}
      />,
    );
    expect(roleInput('Alice').value).toMatch(/viewer/i);
    expect(roleInput('Bob').value).toMatch(/editor/i);
    expect(roleInput('Carol').value).toMatch(/owner/i);
  });
});
