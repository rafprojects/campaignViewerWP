import { useMemo } from 'react';
import { Table, Text, Stack, Tooltip, Badge, ActionIcon, Group } from '@mantine/core';
import { modals } from '@mantine/modals';
import { IconTrash } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import type { CompanyAccessGrant as CompanyAccessGrantType } from '@/services/adminQuery';
import type { CampaignAccessLevel } from '@/types';
import type { AccessViewMode } from '@/hooks/useAdminAccessState';

interface Options {
  accessEntries: CompanyAccessGrantType[];
  accessViewMode: AccessViewMode;
  onRevokeAccess: (entry: CompanyAccessGrantType) => Promise<void>;
}

export function useAccessRows({ accessEntries, accessViewMode, onRevokeAccess }: Options) {
  const { t } = useTranslation('mullion');
  return useMemo(() => {
    // P33-D → P60-I: role label/tip localized at render time. These were a
    // module-level const, which can't call t() and so shipped raw English.
    const roleCfg: Record<CampaignAccessLevel, { label: string; tip: string }> = {
      viewer: {
        label: t('admin_access_role_viewer', '👁 Viewer'),
        tip: t('accessrow_tip_viewer', 'Can read campaign content only'),
      },
      // P53-D → P75-I: editor/owner can no longer be granted. These labels only
      // ever render for legacy grants stored before P53-D, which are treated as
      // view-only — editing comes from the mullion_editor role, not the grant.
      editor: {
        label: t('accessrow_role_editor', '✏️ Editor'),
        tip: t('accessrow_tip_editor_legacy', 'Legacy grant level — treated as view-only. Editing comes from the Gallery Editor role.'),
      },
      owner: {
        label: t('accessrow_role_owner', '👑 Owner'),
        tip: t('accessrow_tip_owner_legacy', 'Legacy grant level — treated as view-only. Editing comes from the Gallery Editor role.'),
      },
    };

    // P64-B: revoke is destructive and — for a company-sourced grant — the
    // outcome differs by view (campaign view blocks THIS campaign only; company
    // view revokes company-wide). Gate every revoke behind a confirm dialog whose
    // copy states the actual outcome, so nobody wipes company-wide access by
    // accident. The dialog does not offer a cross-scope "escalate" action: per-
    // campaign actions live in the campaign view, company-wide in the company view.
    const openRevokeConfirm = (a: CompanyAccessGrantType) => {
      const name = a.user?.displayName ?? t('accessrow_user_short', 'user {{id}}', { id: a.userId });
      const company = a.companyName ?? t('accessrow_this_company', 'this company');
      const isCompanySrc = a.source === 'company';
      const isCampaignView = accessViewMode === 'campaign';

      let title: string;
      let body: string;
      let confirm: string;
      if (isCampaignView && isCompanySrc) {
        // Campaign endpoint writes a per-campaign deny override; company grant kept.
        title = t('accessrow_revoke_block_title', 'Block on this campaign?');
        body = t('accessrow_revoke_block_body', '{{name}} has company-wide access. Blocking here removes them from this campaign only — access to other {{company}} campaigns is kept.', { name, company });
        confirm = t('accessrow_revoke_block_confirm', 'Block on this campaign');
      } else if (isCompanySrc) {
        // Company/All view: the company endpoint revokes company-wide.
        title = t('accessrow_revoke_companywide_title', 'Revoke company-wide access?');
        body = t('accessrow_revoke_companywide_body', 'This revokes company-wide access for {{name}} across ALL campaigns of {{company}}.', { name, company });
        confirm = t('accessrow_revoke_companywide_confirm', 'Revoke company-wide');
      } else {
        // Campaign-sourced grant (either view): plain single-campaign revoke.
        const campaign = isCampaignView
          ? t('accessrow_this_campaign', 'this campaign')
          : (a.campaignTitle ?? t('accessrow_this_campaign', 'this campaign'));
        title = t('accessrow_revoke_title', 'Revoke access?');
        body = t('accessrow_revoke_body', 'Revoke access to {{campaign}} for {{name}}?', { campaign, name });
        confirm = t('accessrow_revoke_confirm', 'Revoke');
      }

      modals.openConfirmModal({
        title,
        children: <Text size="sm">{body}</Text>,
        labels: { confirm, cancel: t('accessrow_revoke_cancel', 'Cancel') },
        confirmProps: { color: 'red' },
        onConfirm: () => { void onRevokeAccess(a); },
      });
    };

    return accessEntries.map((a) => {
      const isExpired = a.is_expired === true;
      // P33-D: normalise access_level — server always sends one, but guard for legacy data.
      const level = (a.access_level ?? 'viewer') as CampaignAccessLevel;
      const cfg = roleCfg[level] ?? roleCfg.viewer;

      return (
        <Table.Tr
          key={`${a.userId}-${a.source}-${a.campaignId || 'company'}`}
          style={{
            ...(a.source === 'company' ? { backgroundColor: 'color-mix(in srgb, var(--mullion-color-primary) 5%, transparent)' } : {}),
            ...(isExpired ? { opacity: 0.55 } : {}),
          }}
        >
          <Table.Td>
            {a.user ? (
              <Stack gap={2}>
                <Text size="sm" fw={500}>{a.user.displayName}</Text>
                <Text size="xs" c="dimmed">{a.user.email}</Text>
              </Stack>
            ) : (
              <Text size="sm">{t('accessrow_user_fallback', 'User #{{id}}', { id: a.userId })}</Text>
            )}
          </Table.Td>
          <Table.Td>
            <Stack gap={2}>
              <Tooltip label={a.source === 'company' ? t('accessrow_src_company_tip', 'Company-wide access') : t('accessrow_src_campaign_tip', 'Direct campaign access')}>
                <Badge variant="light" color={a.source === 'company' ? 'blue' : 'green'}>
                  {a.source === 'company' ? t('accessrow_src_company', '🏢 Company') : t('accessrow_src_campaign', '📋 Campaign')}
                </Badge>
              </Tooltip>
              {isExpired && (
                <Badge variant="light" color="gray" size="xs">{t('admin_sched_expired', 'Expired')}</Badge>
              )}
              {accessViewMode === 'all' && a.source === 'campaign' && a.campaignTitle && (
                <Text size="xs" c="dimmed">{a.campaignTitle}</Text>
              )}
            </Stack>
          </Table.Td>
          {/* P33-D role column → P51-H editable dropdown → P75-I read-only badge.
              Grants are viewer-only (P53-D), so there is nothing to pick: the
              server's access_level enum is ['viewer'] and the levels are not
              consulted by any gate. Legacy editor/owner grants stored before
              P53-D still show their own level, tooltipped as view-only. */}
          <Table.Td>
            <Group gap="xs" wrap="nowrap">
              <Tooltip label={cfg.tip} withArrow>
                <Badge
                  variant="light"
                  color={level === 'viewer' ? 'gray' : 'yellow'}
                  aria-label={t('admin_space_role_for', 'Role for {{name}}', { name: a.user?.displayName ?? t('accessrow_user_short', 'user {{id}}', { id: a.userId }) })}
                >
                  {cfg.label}
                </Badge>
              </Tooltip>
            </Group>
          </Table.Td>
          <Table.Td>
            <Stack gap={2}>
              <Text size="xs">{a.grantedAt ? new Date(a.grantedAt).toLocaleString() : '—'}</Text>
              {a.expires_at && (
                <Tooltip label={isExpired ? t('accessrow_expires_tip_expired', 'This grant has expired') : t('accessrow_expires_tip_active', 'Grant expires at this time')}>
                  <Text size="xs" c={isExpired ? 'red' : 'dimmed'}>
                    {t('accessrow_expires_label', 'Expires: {{date}}', { date: new Date(a.expires_at).toLocaleString() })}
                  </Text>
                </Tooltip>
              )}
            </Stack>
          </Table.Td>
          <Table.Td>
            <Tooltip label={a.source === 'company' ? t('accessrow_revoke_company_tip', 'Revoke company-wide access') : t('accessrow_revoke_campaign_tip', 'Revoke campaign access')}>
              <ActionIcon color="red" variant="light" size="lg" onClick={() => openRevokeConfirm(a)} aria-label={t('admin_space_revoke_aria', 'Revoke access')}>
                <IconTrash size={16} />
              </ActionIcon>
            </Tooltip>
          </Table.Td>
        </Table.Tr>
      );
    });
  }, [accessEntries, accessViewMode, onRevokeAccess, t]);
}
