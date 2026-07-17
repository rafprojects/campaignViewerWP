import { useMemo } from 'react';
import { Table, Text, Stack, Tooltip, Badge, ActionIcon, Group, Select } from '@mantine/core';
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
  // P51-H: change an existing grant's role via the inline dropdown.
  onChangeRole: (entry: CompanyAccessGrantType, level: CampaignAccessLevel) => Promise<void>;
}

// P51-H: display order for the inline role Select / badge config.
const ROLE_ORDER: CampaignAccessLevel[] = ['viewer', 'editor', 'owner'];

export function useAccessRows({ accessEntries, accessViewMode, onRevokeAccess, onChangeRole }: Options) {
  const { t } = useTranslation('wpsg');
  return useMemo(() => {
    // P33-D → P60-I: role label/tip localized at render time. These were a
    // module-level const, which can't call t() and so shipped raw English.
    const roleCfg: Record<CampaignAccessLevel, { label: string; tip: string }> = {
      viewer: {
        label: t('admin_access_role_viewer', '👁 Viewer'),
        tip: t('accessrow_tip_viewer', 'Can read campaign content only'),
      },
      editor: {
        label: t('accessrow_role_editor', '✏️ Editor'),
        tip: t('accessrow_tip_editor', 'Can edit metadata and media; cannot manage access or builder'),
      },
      owner: {
        label: t('accessrow_role_owner', '👑 Owner'),
        tip: t('accessrow_tip_owner', 'Full campaign control including access management and builder'),
      },
    };
    // P51-H: ordered options for the inline role Select.
    const roleSelectOptions = ROLE_ORDER.map((value) => ({ value, label: roleCfg[value].label }));

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
            ...(a.source === 'company' ? { backgroundColor: 'color-mix(in srgb, var(--wpsg-color-primary) 5%, transparent)' } : {}),
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
          {/* P33-D role column → P51-H: editable role dropdown */}
          <Table.Td>
            <Group gap="xs" wrap="nowrap">
              <Tooltip label={cfg.tip} withArrow>
                <Select
                  size="xs"
                  variant="filled"
                  w={150}
                  data={roleSelectOptions}
                  value={level}
                  allowDeselect={false}
                  comboboxProps={{ withinPortal: true }}
                  aria-label={t('admin_space_role_for', 'Role for {{name}}', { name: a.user?.displayName ?? t('accessrow_user_short', 'user {{id}}', { id: a.userId }) })}
                  onChange={(val) => {
                    if (val && val !== level) {
                      void onChangeRole(a, val as CampaignAccessLevel);
                    }
                  }}
                />
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
  }, [accessEntries, accessViewMode, onRevokeAccess, onChangeRole, t]);
}
