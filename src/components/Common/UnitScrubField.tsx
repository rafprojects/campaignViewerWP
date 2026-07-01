import { type ReactNode, useRef } from 'react';
import { NumberInput, Select, type NumberInputProps } from '@mantine/core';
import { IconArrowsHorizontal } from '@tabler/icons-react';
import { UNIT_MAX_DEFAULTS } from '@wp-super-gallery/shared-utils';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

export interface UnitScrubFieldProps {
  /** Label for the field. Also doubles as the drag-to-scrub handle when present. */
  label?: ReactNode | undefined;
  /** Description text below the label */
  description?: string | undefined;
  /** Current numeric value, or '' for an empty/cleared field */
  value: number | '';
  /** Current unit (e.g. 'px', '%', 'em') */
  unit: string;
  /** Called when the numeric value changes (typing or scrubbing) */
  onValueChange: (value: number | '') => void;
  /**
   * Called when the unit changes. The component auto-clamps the current value to
   * the new unit's max and passes that clamped value alongside the unit, so a
   * consumer that serializes value+unit together (e.g. CssValueInput) can emit a
   * single, consistent update instead of racing two callbacks.
   */
  onUnitChange: (unit: string, clampedValue: number | '') => void;
  /** Allowed unit options. If single-element, the unit selector is hidden. */
  allowedUnits: readonly string[];
  /** Explicit minimum (default 0, or -max when allowNegative) */
  min?: number | undefined;
  /** Explicit maximum for the field's base unit. Overridden per-unit via UNIT_MAX_DEFAULTS. */
  max?: number | undefined;
  /** Step increment for typing/arrow-keys, and the default scrub sensitivity. */
  step?: number | undefined;
  /** Pixels-of-drag-per-step for scrubbing. Defaults to `step`. */
  scrubStep?: number | undefined;
  /** Whether to allow negative values (default false). When true, min defaults to -max instead of 0. */
  allowNegative?: boolean | undefined;
  placeholder?: string | undefined;
  numberInputProps?: Partial<NumberInputProps> | undefined;
}

/**
 * Low-level shared control: a NumberInput with the unit selector embedded in its own
 * rightSection (Elementor-style — one bordered box, no separate boxed dropdown), plus
 * drag-to-scrub on the label.
 *
 * Internal building block for DimensionInput (number+unit contract) and CssValueInput
 * (CSS-string contract) — not intended to be used directly by feature code.
 */
export function UnitScrubField({
  label,
  description,
  value,
  unit,
  onValueChange,
  onUnitChange,
  allowedUnits,
  min,
  max,
  step = 1,
  scrubStep,
  allowNegative = false,
  placeholder,
  numberInputProps,
}: UnitScrubFieldProps) {
  const resolvedMax = resolveMax(unit, max);
  const resolvedMin = min ?? (allowNegative ? -resolvedMax : 0);

  const scrubRef = useRef<{ startX: number; startValue: number } | null>(null);

  const handleUnitChange = (newUnit: string) => {
    const newMax = resolveMax(newUnit, max);
    const newMin = min ?? (allowNegative ? -newMax : 0);
    const clamped =
      typeof value === 'number' ? Math.max(newMin, Math.min(newMax, value)) : value;
    if (typeof value === 'number' && clamped !== value) onValueChange(clamped);
    onUnitChange(newUnit, clamped);
  };

  const showUnitSelector = allowedUnits.length > 1;
  const effectiveScrubStep = scrubStep ?? step;
  const unitWidth = showUnitSelector
    ? Math.max(34, Math.max(...allowedUnits.map((u) => u.length)) * 7 + 24)
    : undefined;

  return (
    <NumberInput
      label={
        label ? (
          <span
            title="Drag to adjust"
            style={{
              cursor: 'ew-resize',
              userSelect: 'none',
              touchAction: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 2,
            }}
            onPointerDown={(e) => {
              e.preventDefault();
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              scrubRef.current = { startX: e.clientX, startValue: typeof value === 'number' ? value : 0 };
            }}
            onPointerMove={(e) => {
              if (!scrubRef.current || !(e.buttons & 1)) return;
              const delta = e.clientX - scrubRef.current.startX;
              const raw = scrubRef.current.startValue + delta * effectiveScrubStep;
              const rounded = Math.round(raw / step) * step;
              const clamped = Math.max(resolvedMin, Math.min(resolvedMax, rounded));
              onValueChange(Math.round(clamped * 100) / 100);
            }}
            onPointerUp={() => { scrubRef.current = null; }}
            onPointerCancel={() => { scrubRef.current = null; }}
          >
            {label}
            <IconArrowsHorizontal size={11} stroke={1.75} style={{ opacity: 0.55, flexShrink: 0 }} />
          </span>
        ) : undefined
      }
      description={description}
      value={value}
      onChange={(v) => onValueChange(typeof v === 'number' ? v : '')}
      min={resolvedMin}
      max={resolvedMax}
      step={step}
      placeholder={placeholder}
      rightSection={
        showUnitSelector ? (
          <Select
            variant="unstyled"
            data={allowedUnits.map((u) => ({ label: u, value: u }))}
            value={unit}
            onChange={(v) => v && handleUnitChange(v)}
            allowDeselect={false}
            withCheckIcon={false}
            rightSection={null}
            comboboxProps={{ withinPortal: false, width: 'max-content', position: 'bottom-end' }}
            styles={{
              root: { height: '100%' },
              wrapper: { height: '100%' },
              input: {
                height: '100%',
                minHeight: 'unset',
                paddingInline: 0,
                textAlign: 'center',
                fontSize: 'var(--mantine-font-size-xs)',
                color: 'var(--mantine-color-dimmed)',
                cursor: 'pointer',
                borderLeft: '1px solid var(--mantine-color-default-border)',
                borderRadius: 0,
              },
            }}
            aria-label="Unit"
          />
        ) : undefined
      }
      rightSectionWidth={unitWidth}
      {...numberInputProps}
    />
  );
}

/** Resolve the effective max for a given unit, falling back to explicit max for px. */
function resolveMax(unit: string, explicitMax?: number): number {
  if (unit === 'px') return explicitMax ?? UNIT_MAX_DEFAULTS.px ?? 9999;
  return UNIT_MAX_DEFAULTS[unit] ?? UNIT_MAX_DEFAULTS.px ?? 9999;
}

setWpsgDebugDisplayName(UnitScrubField, 'UnitScrubField');
