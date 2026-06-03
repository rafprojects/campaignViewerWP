import { useMemo } from 'react';
import type { AuditEntry } from '@/services/adminQuery';
import { AuditEventRow } from '@/components/Admin/AuditEventRow';

export function useAuditRows(auditEntries: AuditEntry[]) {
  return useMemo(() => {
    return auditEntries
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((e) => <AuditEventRow key={e.id} entry={e} />);
  }, [auditEntries]);
}
