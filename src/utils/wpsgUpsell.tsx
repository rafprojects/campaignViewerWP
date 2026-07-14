import { notifications } from '@mantine/notifications';
import { Anchor, Text } from '@mantine/core';
import i18n from '@/i18n';

/**
 * Show a standardized "this is a Pro feature" upsell notification (P62-A).
 *
 * Used by the LayoutBuilder pro-feature gates (text layers, per-breakpoint
 * responsive, starter library) so every locked-feature interaction produces an
 * identical, translatable toast with an Upgrade CTA. Copy is routed through the
 * shared i18next instance (this is a util, not a React component — the
 * jsx-text-only lint rule does not apply, and all rendered text is a `t(...)`
 * expression rather than a literal).
 *
 * @param messageKey i18next key for the feature-specific message.
 * @param fallback   English default for the message.
 * @param upgradeUrl Pricing/upgrade URL for the CTA (from useWpsgLicense()).
 */
export function showProUpsell(messageKey: string, fallback: string, upgradeUrl: string): void {
  const t = i18n.t.bind(i18n);
  notifications.show({
    title: t('upsell_pro_title', 'Pro feature'),
    color: 'yellow',
    autoClose: 6000,
    message: (
      <Text size="sm">
        {t(messageKey, fallback)}{' '}
        <Anchor href={upgradeUrl} target="_blank" rel="noopener noreferrer">
          {t('upsell_cta', 'Upgrade')}
        </Anchor>
      </Text>
    ),
  });
}
