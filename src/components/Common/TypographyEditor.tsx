import { useCallback, useMemo } from 'react';
import {
  Accordion,
  Group,
  NumberInput,
  Select,
  Stack,
  ActionIcon,
  Text,
  Badge,
} from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { ModalColorInput as ColorInput } from '@/components/Common/ModalColorInput';
import { CssValueInput } from '@/components/Common/CssValueInput';
import type { TypographyOverride } from '@/types';
import {
  loadGoogleFont,
  getFailedFonts,
  CSS_SPACING_UNITS,
  CSS_TRACKING_UNITS,
} from '@wp-super-gallery/shared-utils';
import { useRecentFonts } from '@wp-super-gallery/shared-utils';
import { FONT_FALLBACK_MAP, getTerminalFamily } from '@/data/fontFallbackMap';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

export interface CustomFontEntry {
  /** Display name, e.g. "BrandSans" */
  name: string;
  /** CSS font-family value, e.g. "BrandSans, sans-serif" */
  family: string;
}

interface TypographyEditorProps {
  value: TypographyOverride;
  onChange: (updated: TypographyOverride) => void;
  /** Custom-uploaded fonts available on this site (populated by L-6). */
  customFonts?: CustomFontEntry[];
}

/** Names that need to be loaded from Google Fonts CDN. */
export const GOOGLE_FONT_NAMES: ReadonlySet<string> = new Set([
  // Sans-serif
  'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins',
  'Oswald', 'Raleway', 'Nunito', 'Source Sans 3', 'PT Sans', 'Noto Sans',
  'Work Sans', 'Quicksand', 'Barlow', 'Cabin', 'DM Sans', 'Fira Sans',
  'Karla', 'Mulish', 'Rubik', 'Ubuntu', 'Josefin Sans', 'Manrope',
  'Plus Jakarta Sans', 'Outfit',
  // Serif
  'Playfair Display', 'Merriweather', 'Libre Baskerville', 'Crimson Text',
  'EB Garamond', 'Bitter', 'Cormorant Garamond', 'Lora', 'PT Serif',
  'Noto Serif',
  // Display / Handwriting
  'Dancing Script', 'Pacifico', 'Lobster', 'Caveat', 'Satisfy',
  // Monospace
  'Fira Code', 'JetBrains Mono', 'Source Code Pro',
]);

/* ── System fonts — always available, no CDN dependency ──────────────── */
const SYSTEM_FONT_OPTIONS = [
  { value: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', label: 'System UI' },
  { value: 'Arial, Helvetica, sans-serif', label: 'Arial' },
  { value: 'Helvetica, Arial, sans-serif', label: 'Helvetica' },
  { value: 'Verdana, Geneva, sans-serif', label: 'Verdana' },
  { value: 'Tahoma, Geneva, sans-serif', label: 'Tahoma' },
  { value: 'Trebuchet MS, sans-serif', label: 'Trebuchet MS' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: 'Times New Roman, Times, serif', label: 'Times New Roman' },
  { value: 'Courier New, Courier, monospace', label: 'Courier New' },
  { value: 'monospace', label: 'Monospace' },
];

/* ── Google Fonts — require CDN load ─────────────────────────────────── */
const GOOGLE_FONT_OPTIONS = [
  // Sans-serif
  { value: 'Inter, sans-serif', label: 'Inter' },
  { value: 'Roboto, sans-serif', label: 'Roboto' },
  { value: 'Open Sans, sans-serif', label: 'Open Sans' },
  { value: 'Lato, sans-serif', label: 'Lato' },
  { value: 'Montserrat, sans-serif', label: 'Montserrat' },
  { value: 'Poppins, sans-serif', label: 'Poppins' },
  { value: 'Oswald, sans-serif', label: 'Oswald' },
  { value: 'Raleway, sans-serif', label: 'Raleway' },
  { value: 'Nunito, sans-serif', label: 'Nunito' },
  { value: 'Source Sans 3, sans-serif', label: 'Source Sans 3' },
  { value: 'PT Sans, sans-serif', label: 'PT Sans' },
  { value: 'Noto Sans, sans-serif', label: 'Noto Sans' },
  { value: 'Work Sans, sans-serif', label: 'Work Sans' },
  { value: 'Quicksand, sans-serif', label: 'Quicksand' },
  { value: 'Barlow, sans-serif', label: 'Barlow' },
  { value: 'Cabin, sans-serif', label: 'Cabin' },
  { value: 'DM Sans, sans-serif', label: 'DM Sans' },
  { value: 'Fira Sans, sans-serif', label: 'Fira Sans' },
  { value: 'Karla, sans-serif', label: 'Karla' },
  { value: 'Mulish, sans-serif', label: 'Mulish' },
  { value: 'Rubik, sans-serif', label: 'Rubik' },
  { value: 'Ubuntu, sans-serif', label: 'Ubuntu' },
  { value: 'Josefin Sans, sans-serif', label: 'Josefin Sans' },
  { value: 'Manrope, sans-serif', label: 'Manrope' },
  { value: 'Plus Jakarta Sans, sans-serif', label: 'Plus Jakarta Sans' },
  { value: 'Outfit, sans-serif', label: 'Outfit' },
  // Serif
  { value: 'Playfair Display, serif', label: 'Playfair Display' },
  { value: 'Merriweather, serif', label: 'Merriweather' },
  { value: 'Libre Baskerville, serif', label: 'Libre Baskerville' },
  { value: 'Crimson Text, serif', label: 'Crimson Text' },
  { value: 'EB Garamond, serif', label: 'EB Garamond' },
  { value: 'Bitter, serif', label: 'Bitter' },
  { value: 'Cormorant Garamond, serif', label: 'Cormorant Garamond' },
  { value: 'Lora, serif', label: 'Lora' },
  { value: 'PT Serif, serif', label: 'PT Serif' },
  { value: 'Noto Serif, serif', label: 'Noto Serif' },
  // Display / Handwriting
  { value: 'Dancing Script, cursive', label: 'Dancing Script' },
  { value: 'Pacifico, cursive', label: 'Pacifico' },
  { value: 'Lobster, cursive', label: 'Lobster' },
  { value: 'Caveat, cursive', label: 'Caveat' },
  { value: 'Satisfy, cursive', label: 'Satisfy' },
  // Monospace
  { value: 'Fira Code, monospace', label: 'Fira Code' },
  { value: 'JetBrains Mono, monospace', label: 'JetBrains Mono' },
  { value: 'Source Code Pro, monospace', label: 'Source Code Pro' },
];

/* ── Font names available as fallbacks (proper nouns — not translated) ── */
const FALLBACK_FONT_NAMES = [
  'Arial', 'Helvetica', 'Verdana', 'Tahoma', 'Trebuchet MS',
  'Georgia', 'Times New Roman', 'Courier New',
];

/** Remove undefined/empty-string values so the stored object stays lean. */
function clean(override: TypographyOverride): TypographyOverride {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(override)) {
    if (v !== undefined && v !== '' && v !== null) result[k] = v;
  }
  return result as TypographyOverride;
}

export function TypographyEditor({ value, onChange, customFonts }: TypographyEditorProps) {
  const { t } = useTranslation('wpsg');
  const { recentFonts, addRecentFont } = useRecentFonts();

  // Option lists with translatable descriptors. Font names stay as proper nouns;
  // only the UI descriptors ((none)/(default)/weight/style words) are localised.
  const noneOpt = t('typo_opt_none_paren', '(none)');
  const defaultOpt = t('typo_opt_default_paren', '(default)');
  const fallbackFontOptions = [
    { value: '', label: noneOpt },
    ...FALLBACK_FONT_NAMES.map((n) => ({ value: n, label: n })),
  ];
  const fontWeights = [
    { value: '', label: defaultOpt },
    { value: '100', label: `100 — ${t('typo_w_thin', 'Thin')}` },
    { value: '200', label: `200 — ${t('typo_w_extralight', 'Extra Light')}` },
    { value: '300', label: `300 — ${t('typo_w_light', 'Light')}` },
    { value: '400', label: `400 — ${t('typo_w_normal', 'Normal')}` },
    { value: '500', label: `500 — ${t('typo_w_medium', 'Medium')}` },
    { value: '600', label: `600 — ${t('typo_w_semibold', 'Semi Bold')}` },
    { value: '700', label: `700 — ${t('typo_w_bold', 'Bold')}` },
    { value: '800', label: `800 — ${t('typo_w_extrabold', 'Extra Bold')}` },
    { value: '900', label: `900 — ${t('typo_w_black', 'Black')}` },
  ];
  const fontStyles = [
    { value: '', label: defaultOpt },
    { value: 'normal', label: t('typo_style_normal', 'Normal') },
    { value: 'italic', label: t('typo_style_italic', 'Italic') },
    { value: 'oblique', label: t('typo_style_oblique', 'Oblique') },
  ];
  // UPPERCASE / lowercase / Capitalize labels demonstrate the CSS transform
  // itself (locale-invariant illustration), so only the neutral options localise.
  const textTransforms = [
    { value: '', label: defaultOpt },
    { value: 'none', label: t('typo_opt_none', 'None') },
    { value: 'uppercase', label: 'UPPERCASE' },
    { value: 'lowercase', label: 'lowercase' },
    { value: 'capitalize', label: 'Capitalize' },
  ];
  const textDecorations = [
    { value: '', label: defaultOpt },
    { value: 'none', label: t('typo_opt_none', 'None') },
    { value: 'underline', label: t('typo_td_underline', 'Underline') },
    { value: 'overline', label: t('typo_td_overline', 'Overline') },
    { value: 'line-through', label: t('typo_td_linethrough', 'Line-through') },
  ];

  const set = useCallback(
    <K extends keyof TypographyOverride>(key: K, v: TypographyOverride[K] | '' | undefined) => {
      const next = { ...value, [key]: v === '' ? undefined : v };
      onChange(clean(next));
    },
    [value, onChange],
  );

  const fontFamilyData = useMemo(() => {
    const groups: { group: string; items: { value: string; label: string }[] }[] = [];
    const usedValues = new Set<string>();

    if (recentFonts.length > 0) {
      // Build recent options from all pools
      const allOptions = [...SYSTEM_FONT_OPTIONS, ...GOOGLE_FONT_OPTIONS,
      ...(customFonts ?? []).map((f) => ({ value: f.family, label: f.name })),
      ];
      const recentItems = recentFonts
        .map((name) => allOptions.find((o) => o.label === name))
        .filter((o): o is { value: string; label: string } => !!o);
      if (recentItems.length > 0) {
        groups.push({ group: t('typo_group_recent', 'Recently Used'), items: recentItems });
        for (const item of recentItems) usedValues.add(item.value);
      }
    }

    if (customFonts && customFonts.length > 0) {
      const items = customFonts.map((f) => ({ value: f.family, label: f.name })).filter((o) => !usedValues.has(o.value));
      if (items.length > 0) groups.push({ group: t('typo_group_custom', 'Custom Fonts'), items });
    }

    groups.push({ group: t('typo_group_system', 'System Fonts'), items: SYSTEM_FONT_OPTIONS.filter((o) => !usedValues.has(o.value)) });
    groups.push({ group: t('typo_group_google', 'Google Fonts'), items: GOOGLE_FONT_OPTIONS.filter((o) => !usedValues.has(o.value)) });

    return groups;
  }, [recentFonts, customFonts, t]);

  // ── Fallback chain derived state ──
  const primaryLabel = (value.fontFamily ?? '').split(',')[0]!.trim();
  const suggestedFb1 = FONT_FALLBACK_MAP[primaryLabel]?.[0] ?? '';
  const terminalFamily = primaryLabel ? getTerminalFamily(primaryLabel) : '';
  const isFailed = primaryLabel ? getFailedFonts().has(primaryLabel) : false;

  const hasStroke = !!(value.textStrokeWidth || value.textStrokeColor);
  const hasShadow = !!(value.textShadowBlur || value.textShadowColor);
  const hasGlow = !!(value.textGlowColor || value.textGlowBlur);
  const isEmpty = Object.keys(value).length === 0;

  return (
    <Stack gap="sm">
      {/* Reset button */}
      {!isEmpty && (
        <Group justify="flex-end">
          <ActionIcon
            variant="subtle"
            color="red"
            size="sm"
            title={t('typo_reset', 'Reset all overrides')}
            aria-label={t('typo_reset', 'Reset all overrides')}
            onClick={() => onChange({})}
          >
            <IconTrash size={14} />
          </ActionIcon>
        </Group>
      )}

      {/* ── Core Typography ── */}
      <Select
        label={t('typo_font_family', 'Font Family')}
        value={value.fontFamily ?? ''}
        onChange={(v) => {
          if (v) {
            const name = v.split(',')[0]!.trim();
            if (GOOGLE_FONT_NAMES.has(name)) loadGoogleFont(name);
            addRecentFont(name);
            // Auto-populate fallback 1 from the suggestion map
            const suggestions = FONT_FALLBACK_MAP[name];
            const autoFb1 = (!value.fontFallback1 && suggestions?.[0]) ? suggestions[0] : value.fontFallback1;
            if (!value.fontFallback1 && suggestions?.[0]) {
              console.debug(`[WP Super Gallery] Auto-selected fallback "${suggestions[0]}" for font "${name}"`);
            }
            onChange(clean({ ...value, fontFamily: v, fontFallback1: autoFb1 }));
          } else {
            // Cleared primary — clear fallbacks too
            onChange(clean({ ...value, fontFamily: undefined, fontFallback1: undefined, fontFallback2: undefined }));
          }
        }}
        data={fontFamilyData}
        searchable
        clearable
        size="xs"
      />

      {/* ── Fallback Chain (shown when a primary font is selected) ── */}
      {primaryLabel && GOOGLE_FONT_NAMES.has(primaryLabel) && (
        <Stack gap={4}>
          {isFailed && (
            <Badge color="orange" variant="light" size="sm" radius="sm" style={{ alignSelf: 'flex-start' }}>
              {t('typo_font_failed', '⚠ Font failed to load — first available fallback will be used')}
            </Badge>
          )}
          <Group grow gap="sm">
            <Select
              label={t('typo_fallback1', 'Fallback 1')}
              description={suggestedFb1 && !value.fontFallback1 ? t('typo_suggested', 'Suggested: {{font}}', { font: suggestedFb1 }) : undefined}
              value={value.fontFallback1 ?? ''}
              onChange={(v) => set('fontFallback1', v || undefined)}
              data={fallbackFontOptions}
              size="xs"
              clearable
            />
            <Select
              label={t('typo_fallback2', 'Fallback 2')}
              value={value.fontFallback2 ?? ''}
              onChange={(v) => set('fontFallback2', v || undefined)}
              data={fallbackFontOptions}
              size="xs"
              clearable
            />
          </Group>
          <Text size="xs" c="dimmed">
            {t('typo_terminal', 'Terminal: {{family}}', { family: terminalFamily })}
          </Text>
        </Stack>
      )}

      <Group grow gap="sm">
        <CssValueInput
          label={t('typo_font_size', 'Font Size')}
          value={value.fontSize}
          onChange={(v) => set('fontSize', v)}
          allowedUnits={CSS_SPACING_UNITS}
          max={500}
        />
        <Select
          label={t('typo_font_weight', 'Font Weight')}
          value={value.fontWeight != null ? String(value.fontWeight) : ''}
          onChange={(v) => set('fontWeight', v ? Number(v) : undefined)}
          data={fontWeights}
          size="xs"
        />
      </Group>

      <Group grow gap="sm">
        <Select
          label={t('typo_font_style', 'Font Style')}
          value={value.fontStyle ?? ''}
          onChange={(v) => set('fontStyle', (v as TypographyOverride['fontStyle']) || undefined)}
          data={fontStyles}
          size="xs"
        />
        <Select
          label={t('typo_transform', 'Transform')}
          value={value.textTransform ?? ''}
          onChange={(v) => set('textTransform', (v as TypographyOverride['textTransform']) || undefined)}
          data={textTransforms}
          size="xs"
        />
      </Group>

      <Group grow gap="sm">
        <Select
          label={t('typo_decoration', 'Decoration')}
          value={value.textDecoration ?? ''}
          onChange={(v) => set('textDecoration', (v as TypographyOverride['textDecoration']) || undefined)}
          data={textDecorations}
          size="xs"
        />
        <ColorInput
          label={t('typo_color', 'Color')}
          value={value.color ?? ''}
          onChange={(v) => set('color', v || undefined)}
          size="xs"
        />
      </Group>

      <Group grow gap="sm">
        <NumberInput
          label={t('typo_line_height', 'Line Height')}
          placeholder={t('typo_line_height_ph', 'e.g. 1.4')}
          value={value.lineHeight ?? ''}
          onChange={(v) => set('lineHeight', typeof v === 'number' ? v : undefined)}
          min={0.5}
          max={5}
          step={0.1}
          decimalScale={2}
          size="xs"
        />
        <CssValueInput
          label={t('typo_letter_spacing', 'Letter Spacing')}
          value={value.letterSpacing}
          onChange={(v) => set('letterSpacing', v)}
          allowedUnits={CSS_TRACKING_UNITS}
          allowNegative
          step={0.01}
          max={20}
        />
        <CssValueInput
          label={t('typo_word_spacing', 'Word Spacing')}
          value={value.wordSpacing}
          onChange={(v) => set('wordSpacing', v)}
          allowedUnits={CSS_TRACKING_UNITS}
          allowNegative
          step={0.01}
          max={50}
        />
      </Group>

      {/* ── Advanced Effects ── */}
      <Accordion variant="separated" chevronPosition="left" mt="xs" styles={{ content: { padding: '8px 12px' } }}>
        {/* Stroke */}
        <Accordion.Item value="stroke">
          <Accordion.Control>
            <Text size="xs" fw={500}>
              {t('typo_stroke', 'Stroke')} {hasStroke ? '●' : ''}
            </Text>
          </Accordion.Control>
          <Accordion.Panel>
            <Group grow gap="sm">
              <CssValueInput
                label={t('typo_width', 'Width')}
                value={value.textStrokeWidth}
                onChange={(v) => set('textStrokeWidth', v)}
                allowedUnits={CSS_TRACKING_UNITS}
                step={0.5}
                max={20}
              />
              <ColorInput
                label={t('typo_color', 'Color')}
                value={value.textStrokeColor ?? ''}
                onChange={(v) => set('textStrokeColor', v || undefined)}
                size="xs"
              />
            </Group>
          </Accordion.Panel>
        </Accordion.Item>

        {/* Shadow */}
        <Accordion.Item value="shadow">
          <Accordion.Control>
            <Text size="xs" fw={500}>
              {t('typo_shadow', 'Shadow')} {hasShadow ? '●' : ''}
            </Text>
          </Accordion.Control>
          <Accordion.Panel>
            <Stack gap="sm">
              <Group grow gap="sm">
                <CssValueInput
                  label={t('typo_offset_x', 'Offset X')}
                  value={value.textShadowOffsetX}
                  onChange={(v) => set('textShadowOffsetX', v)}
                  allowedUnits={CSS_TRACKING_UNITS}
                  allowNegative
                  max={50}
                />
                <CssValueInput
                  label={t('typo_offset_y', 'Offset Y')}
                  value={value.textShadowOffsetY}
                  onChange={(v) => set('textShadowOffsetY', v)}
                  allowedUnits={CSS_TRACKING_UNITS}
                  allowNegative
                  max={50}
                />
              </Group>
              <Group grow gap="sm">
                <CssValueInput
                  label={t('typo_blur', 'Blur')}
                  value={value.textShadowBlur}
                  onChange={(v) => set('textShadowBlur', v)}
                  allowedUnits={CSS_TRACKING_UNITS}
                  max={100}
                />
                <ColorInput
                  label={t('typo_color', 'Color')}
                  format="hexa"
                  value={value.textShadowColor ?? ''}
                  onChange={(v) => set('textShadowColor', v || undefined)}
                  size="xs"
                />
              </Group>
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>

        {/* Glow */}
        <Accordion.Item value="glow">
          <Accordion.Control>
            <Text size="xs" fw={500}>
              {t('typo_glow', 'Glow')} {hasGlow ? '●' : ''}
            </Text>
          </Accordion.Control>
          <Accordion.Panel>
            <Group grow gap="sm">
              <ColorInput
                label={t('typo_glow_color', 'Glow Color')}
                format="hexa"
                value={value.textGlowColor ?? ''}
                onChange={(v) => set('textGlowColor', v || undefined)}
                size="xs"
              />
              <CssValueInput
                label={t('typo_glow_blur', 'Glow Blur')}
                value={value.textGlowBlur}
                onChange={(v) => set('textGlowBlur', v)}
                allowedUnits={CSS_TRACKING_UNITS}
                max={100}
              />
            </Group>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </Stack>
  );
}

setWpsgDebugDisplayName(TypographyEditor, 'TypographyEditor');