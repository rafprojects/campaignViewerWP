import { useCallback } from 'react';
import {
  Accordion,
  ColorInput,
  Group,
  NumberInput,
  Select,
  Stack,
  TextInput,
  ActionIcon,
  Text,
} from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import type { TypographyOverride } from '@/types';
import { loadGoogleFont } from '@/utils/loadGoogleFont';

interface TypographyEditorProps {
  value: TypographyOverride;
  onChange: (updated: TypographyOverride) => void;
}

/** Names that need to be loaded from Google Fonts CDN. */
export const GOOGLE_FONT_NAMES = new Set([
  'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat',
  'Poppins', 'Oswald', 'Raleway', 'Playfair Display', 'Merriweather',
]);

const FONT_FAMILIES = [
  { value: '', label: '(default)' },
  { value: 'Inter, sans-serif', label: 'Inter' },
  { value: 'Roboto, sans-serif', label: 'Roboto' },
  { value: 'Open Sans, sans-serif', label: 'Open Sans' },
  { value: 'Lato, sans-serif', label: 'Lato' },
  { value: 'Montserrat, sans-serif', label: 'Montserrat' },
  { value: 'Poppins, sans-serif', label: 'Poppins' },
  { value: 'Oswald, sans-serif', label: 'Oswald' },
  { value: 'Raleway, sans-serif', label: 'Raleway' },
  { value: 'Playfair Display, serif', label: 'Playfair Display' },
  { value: 'Merriweather, serif', label: 'Merriweather' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: 'system-ui, sans-serif', label: 'System UI' },
  { value: 'monospace', label: 'Monospace' },
];

const FONT_WEIGHTS = [
  { value: '', label: '(default)' },
  { value: '100', label: '100 — Thin' },
  { value: '200', label: '200 — Extra Light' },
  { value: '300', label: '300 — Light' },
  { value: '400', label: '400 — Normal' },
  { value: '500', label: '500 — Medium' },
  { value: '600', label: '600 — Semi Bold' },
  { value: '700', label: '700 — Bold' },
  { value: '800', label: '800 — Extra Bold' },
  { value: '900', label: '900 — Black' },
];

const FONT_STYLES = [
  { value: '', label: '(default)' },
  { value: 'normal', label: 'Normal' },
  { value: 'italic', label: 'Italic' },
  { value: 'oblique', label: 'Oblique' },
];

const TEXT_TRANSFORMS = [
  { value: '', label: '(default)' },
  { value: 'none', label: 'None' },
  { value: 'uppercase', label: 'UPPERCASE' },
  { value: 'lowercase', label: 'lowercase' },
  { value: 'capitalize', label: 'Capitalize' },
];

const TEXT_DECORATIONS = [
  { value: '', label: '(default)' },
  { value: 'none', label: 'None' },
  { value: 'underline', label: 'Underline' },
  { value: 'overline', label: 'Overline' },
  { value: 'line-through', label: 'Line-through' },
];

/** Remove undefined/empty-string values so the stored object stays lean. */
function clean(override: TypographyOverride): TypographyOverride {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(override)) {
    if (v !== undefined && v !== '' && v !== null) result[k] = v;
  }
  return result as TypographyOverride;
}

export function TypographyEditor({ value, onChange }: TypographyEditorProps) {
  const set = useCallback(
    <K extends keyof TypographyOverride>(key: K, v: TypographyOverride[K] | '' | undefined) => {
      const next = { ...value, [key]: v === '' ? undefined : v };
      onChange(clean(next));
    },
    [value, onChange],
  );

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
            title="Reset all overrides"
            onClick={() => onChange({})}
          >
            <IconTrash size={14} />
          </ActionIcon>
        </Group>
      )}

      {/* ── Core Typography ── */}
      <Select
        label="Font Family"
        value={value.fontFamily ?? ''}
        onChange={(v) => {
          if (v) {
            const name = v.split(',')[0].trim();
            if (GOOGLE_FONT_NAMES.has(name)) loadGoogleFont(name);
          }
          set('fontFamily', v ?? undefined);
        }}
        data={FONT_FAMILIES}
        searchable
        clearable
        size="xs"
      />

      <Group grow gap="sm">
        <TextInput
          label="Font Size"
          placeholder="e.g. 14px, 0.875rem"
          value={value.fontSize ?? ''}
          onChange={(e) => set('fontSize', e.currentTarget.value || undefined)}
          size="xs"
        />
        <Select
          label="Font Weight"
          value={value.fontWeight != null ? String(value.fontWeight) : ''}
          onChange={(v) => set('fontWeight', v ? Number(v) : undefined)}
          data={FONT_WEIGHTS}
          size="xs"
        />
      </Group>

      <Group grow gap="sm">
        <Select
          label="Font Style"
          value={value.fontStyle ?? ''}
          onChange={(v) => set('fontStyle', (v as TypographyOverride['fontStyle']) || undefined)}
          data={FONT_STYLES}
          size="xs"
        />
        <Select
          label="Transform"
          value={value.textTransform ?? ''}
          onChange={(v) => set('textTransform', (v as TypographyOverride['textTransform']) || undefined)}
          data={TEXT_TRANSFORMS}
          size="xs"
        />
      </Group>

      <Group grow gap="sm">
        <Select
          label="Decoration"
          value={value.textDecoration ?? ''}
          onChange={(v) => set('textDecoration', (v as TypographyOverride['textDecoration']) || undefined)}
          data={TEXT_DECORATIONS}
          size="xs"
        />
        <ColorInput
          label="Color"
          value={value.color ?? ''}
          onChange={(v) => set('color', v || undefined)}
          size="xs"
        />
      </Group>

      <Group grow gap="sm">
        <NumberInput
          label="Line Height"
          placeholder="e.g. 1.4"
          value={value.lineHeight ?? ''}
          onChange={(v) => set('lineHeight', typeof v === 'number' ? v : undefined)}
          min={0.5}
          max={5}
          step={0.1}
          decimalScale={2}
          size="xs"
        />
        <TextInput
          label="Letter Spacing"
          placeholder="e.g. 0.02em"
          value={value.letterSpacing ?? ''}
          onChange={(e) => set('letterSpacing', e.currentTarget.value || undefined)}
          size="xs"
        />
        <TextInput
          label="Word Spacing"
          placeholder="e.g. 0.1em"
          value={value.wordSpacing ?? ''}
          onChange={(e) => set('wordSpacing', e.currentTarget.value || undefined)}
          size="xs"
        />
      </Group>

      {/* ── Advanced Effects ── */}
      <Accordion variant="separated" chevronPosition="left" mt="xs" styles={{ content: { padding: '8px 12px' } }}>
        {/* Stroke */}
        <Accordion.Item value="stroke">
          <Accordion.Control>
            <Text size="xs" fw={500}>
              Stroke {hasStroke ? '●' : ''}
            </Text>
          </Accordion.Control>
          <Accordion.Panel>
            <Group grow gap="sm">
              <TextInput
                label="Width"
                placeholder="e.g. 1px"
                value={value.textStrokeWidth ?? ''}
                onChange={(e) => set('textStrokeWidth', e.currentTarget.value || undefined)}
                size="xs"
              />
              <ColorInput
                label="Color"
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
              Shadow {hasShadow ? '●' : ''}
            </Text>
          </Accordion.Control>
          <Accordion.Panel>
            <Stack gap="sm">
              <Group grow gap="sm">
                <TextInput
                  label="Offset X"
                  placeholder="e.g. 2px"
                  value={value.textShadowOffsetX ?? ''}
                  onChange={(e) => set('textShadowOffsetX', e.currentTarget.value || undefined)}
                  size="xs"
                />
                <TextInput
                  label="Offset Y"
                  placeholder="e.g. 2px"
                  value={value.textShadowOffsetY ?? ''}
                  onChange={(e) => set('textShadowOffsetY', e.currentTarget.value || undefined)}
                  size="xs"
                />
              </Group>
              <Group grow gap="sm">
                <TextInput
                  label="Blur"
                  placeholder="e.g. 4px"
                  value={value.textShadowBlur ?? ''}
                  onChange={(e) => set('textShadowBlur', e.currentTarget.value || undefined)}
                  size="xs"
                />
                <ColorInput
                  label="Color"
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
              Glow {hasGlow ? '●' : ''}
            </Text>
          </Accordion.Control>
          <Accordion.Panel>
            <Group grow gap="sm">
              <ColorInput
                label="Glow Color"
                format="hexa"
                value={value.textGlowColor ?? ''}
                onChange={(v) => set('textGlowColor', v || undefined)}
                size="xs"
              />
              <TextInput
                label="Glow Blur"
                placeholder="e.g. 10px"
                value={value.textGlowBlur ?? ''}
                onChange={(e) => set('textGlowBlur', e.currentTarget.value || undefined)}
                size="xs"
              />
            </Group>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </Stack>
  );
}
