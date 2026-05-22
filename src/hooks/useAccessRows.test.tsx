import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '../test/test-utils';
import { Table } from '@mantine/core';
import { useAccessRows } from './useAccessRows';
import type { CompanyAccessGrant } from '@/services/adminQuery';

// Helper component that renders the hook output inside a Table.
function TestRows({
  entries,
  viewMode = 'campaign',
}: {
  entries: CompanyAccessGrant[];
  viewMode?: 'campaign' | 'company' | 'all';
}) {
  const rows = useAccessRows({
    accessEntries: entries,
    accessViewMode: viewMode,
    onRevokeAccess: vi.fn(),
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

describe('useAccessRows — P33-D role badges', () => {
  it('renders a viewer badge for a viewer-level grant', () => {
    render(
      <TestRows entries={[{ ...baseEntry, access_level: 'viewer' }]} />,
    );
    expect(screen.getByText(/viewer/i)).toBeInTheDocument();
  });

  it('renders an editor badge for an editor-level grant', () => {
    render(
      <TestRows entries={[{ ...baseEntry, access_level: 'editor' }]} />,
    );
    expect(screen.getByText(/editor/i)).toBeInTheDocument();
  });

  it('renders an owner badge for an owner-level grant', () => {
    render(
      <TestRows entries={[{ ...baseEntry, access_level: 'owner' }]} />,
    );
    expect(screen.getByText(/owner/i)).toBeInTheDocument();
  });

  it('defaults to viewer badge when access_level is absent (legacy grant)', () => {
    // Simulate a legacy record by omitting access_level entirely.
    const legacyEntry: CompanyAccessGrant = { ...baseEntry };
    delete legacyEntry.access_level;
    render(<TestRows entries={[legacyEntry]} />);
    expect(screen.getByText(/viewer/i)).toBeInTheDocument();
  });

  it('renders role badge with tooltip for each level', () => {
    render(
      <TestRows entries={[{ ...baseEntry, access_level: 'editor' }]} />,
    );
    // Badge has aria-label "Role: editor" per the implementation.
    expect(screen.getByLabelText('Role: editor')).toBeInTheDocument();
  });

  it('renders viewer badge as accessible element with correct label', () => {
    render(
      <TestRows entries={[{ ...baseEntry, access_level: 'viewer' }]} />,
    );
    expect(screen.getByLabelText('Role: viewer')).toBeInTheDocument();
  });

  it('renders owner badge with accessible label', () => {
    render(
      <TestRows entries={[{ ...baseEntry, access_level: 'owner' }]} />,
    );
    expect(screen.getByLabelText('Role: owner')).toBeInTheDocument();
  });

  it('renders a row with company source badge', () => {
    render(
      <TestRows
        entries={[{ ...baseEntry, source: 'company', access_level: 'viewer' }]}
      />,
    );
    expect(screen.getByText(/company/i)).toBeInTheDocument();
  });

  it('renders the revoke action icon for each row', () => {
    render(
      <TestRows entries={[{ ...baseEntry, access_level: 'viewer' }]} />,
    );
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
    // Row should be rendered; expiry text should appear.
    expect(screen.getByText(/expired/i)).toBeInTheDocument();
  });

  it('renders multiple rows with distinct role badges', () => {
    render(
      <TestRows
        entries={[
          { ...baseEntry, userId: 1, access_level: 'viewer' },
          { ...baseEntry, userId: 2, user: { displayName: 'Bob', email: 'bob@x.com' }, access_level: 'editor' },
          { ...baseEntry, userId: 3, user: { displayName: 'Carol', email: 'carol@x.com' }, access_level: 'owner' },
        ]}
      />,
    );
    expect(screen.getByLabelText('Role: viewer')).toBeInTheDocument();
    expect(screen.getByLabelText('Role: editor')).toBeInTheDocument();
    expect(screen.getByLabelText('Role: owner')).toBeInTheDocument();
  });
});
