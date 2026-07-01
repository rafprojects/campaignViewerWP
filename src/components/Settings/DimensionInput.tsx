import { type ReactNode } from 'react';
import { type NumberInputProps } from '@mantine/core';
import { UnitScrubField } from '@/components/Common/UnitScrubField';

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
 * Compound dimension control: NumberInput + unit Select, with drag-to-scrub on the label.
 *
 * When the user switches units, the current value is clamped to the new unit's
 * sensible range (e.g. px 3000 → vw 100) and both onValueChange and
 * onUnitChange fire.
 *
 * Thin adapter over the shared UnitScrubField — this keeps DimensionInput's
 * required-number+unit contract unchanged for its existing call sites.
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
  return (
    <UnitScrubField
      label={label}
      description={description}
      value={value}
      unit={unit}
      onValueChange={(v) => onValueChange(typeof v === 'number' ? v : 0)}
      onUnitChange={onUnitChange}
      allowedUnits={allowedUnits}
      min={min}
      max={max}
      step={step}
      placeholder={placeholder}
      allowNegative={allowNegative}
      numberInputProps={numberInputProps}
    />
  );
}
