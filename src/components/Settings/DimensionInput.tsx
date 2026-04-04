import { type ReactNode } from 'react';
import { Group, NumberInput, Select, type NumberInputProps } from '@mantine/core';
import { UNIT_MAX_DEFAULTS } from '@/utils/cssUnits';

export interface DimensionInputProps {
  /** Current numeric value */
  value: number;
  /** Current unit (e.g. 'px', '%', 'vw') */
  unit: string;
  /** Called when the numeric value changes */
  onValueChange: (value: number) => void;
  /** Called when the unit changes. The component auto-clamps the current value to the new unit's max. */
  onUnitChange: (unit: string) => void;
  /** Allowed unit options (e.g. CSS_WIDTH_UNITS). If single-element, the SegmentedControl is hidden. */
  allowedUnits: readonly string[];
  /** Label for the NumberInput */
  label?: ReactNode;
  /** Description text below the label */
  description?: string;
  /** Explicit minimum (default 0) */
  min?: number;
  /** Explicit maximum for px. Overridden per-unit via UNIT_MAX_DEFAULTS when unit ≠ px. */
  max?: number;
  /** Step increment */
  step?: number;
  /** Placeholder text */
  placeholder?: string;
  /** Whether to allow negative values (default false). When true, min defaults to -max instead of 0. */
  allowNegative?: boolean;
  /** Extra NumberInput props passed through */
  numberInputProps?: Partial<NumberInputProps>;
}

/**
 * Compound dimension control: NumberInput + SegmentedControl unit switcher.
 *
 * When the user switches units, the current value is clamped to the new unit's
 * sensible range (e.g. px 3000 → vw 100) and both onValueChange and
 * onUnitChange fire.
 */
export function DimensionInput({
  value,
  unit,
  onValueChange,
  onUnitChange,
  allowedUnits,
  label,
  description,
  min,
  max,
  step = 1,
  placeholder,
  allowNegative = false,
  numberInputProps,
}: DimensionInputProps) {
  const resolvedMax = resolveMax(unit, max);
  const resolvedMin = min ?? (allowNegative ? -resolvedMax : 0);

  const handleUnitChange = (newUnit: string) => {
    const newMax = resolveMax(newUnit, max);
    const newMin = min ?? (allowNegative ? -newMax : 0);
    // Clamp the current value to the new unit's range
    const clamped = Math.max(newMin, Math.min(newMax, value));
    if (clamped !== value) {
      onValueChange(clamped);
    }
    onUnitChange(newUnit);
  };

  const showUnitSelector = allowedUnits.length > 1;

  return (
    <Group gap="xs" align="flex-end" wrap="nowrap">
      <NumberInput
        label={label}
        description={description}
        value={value}
        onChange={(v) => onValueChange(typeof v === 'number' ? v : 0)}
        min={resolvedMin}
        max={resolvedMax}
        step={step}
        placeholder={placeholder}
        style={{ flex: 1 }}
        {...numberInputProps}
      />
      {showUnitSelector && (
        <Select
          size="xs"
          data={allowedUnits.map((u) => ({ label: u, value: u }))}
          value={unit}
          onChange={(v) => v && handleUnitChange(v)}
          allowDeselect={false}
          withCheckIcon={false}
          styles={{ root: { flexShrink: 0, width: 72 } }}
          aria-label="Unit"
        />
      )}
    </Group>
  );
}

/** Resolve the effective max for a given unit, falling back to explicit max for px. */
function resolveMax(unit: string, explicitMax?: number): number {
  if (unit === 'px') return explicitMax ?? UNIT_MAX_DEFAULTS.px;
  return UNIT_MAX_DEFAULTS[unit] ?? UNIT_MAX_DEFAULTS.px;
}
