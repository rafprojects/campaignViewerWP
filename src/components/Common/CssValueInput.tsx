import { useState } from 'react';
import { parseCss, toCss } from '@wp-super-gallery/shared-utils';
import { UnitScrubField } from '@/components/Common/UnitScrubField';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

export interface CssValueInputProps {
  label: string;
  /** Raw CSS value, e.g. '28px', or undefined for "no override". */
  value: string | undefined;
  onChange: (next: string | undefined) => void;
  allowedUnits: readonly string[];
  /** Unit assumed for unit-less legacy values and for a fresh value typed before a unit is picked. */
  defaultUnit?: string;
  min?: number;
  max?: number;
  step?: number;
  allowNegative?: boolean;
  placeholder?: string;
}

/**
 * Value+unit editor for CSS-string-typed fields (e.g. TypographyOverride's fontSize,
 * letterSpacing, textShadowBlur, ...). A bare number can never reach the stored value —
 * every edit serializes a complete "<number><unit>" string via the shared UnitScrubField.
 */
export function CssValueInput({
  label,
  value,
  onChange,
  allowedUnits,
  defaultUnit = 'px',
  min,
  max,
  step,
  allowNegative,
  placeholder,
}: CssValueInputProps) {
  const parsed = parseCss(value, defaultUnit);
  // Remembers a unit picked before any number has been typed (value is still undefined).
  const [draftUnit, setDraftUnit] = useState(defaultUnit);
  const unit = parsed?.unit ?? draftUnit;

  return (
    <UnitScrubField
      label={label}
      value={parsed?.value ?? ''}
      unit={unit}
      onValueChange={(v) => onChange(v === '' ? undefined : toCss(v, unit))}
      onUnitChange={(u, clampedValue) => {
        setDraftUnit(u);
        // Serialize the already-clamped value with the new unit in one call, so
        // switching to a smaller-range unit persists the clamp (not the stale
        // pre-clamp value) — see UnitScrubField.onUnitChange.
        if (clampedValue !== '') onChange(toCss(clampedValue, u));
      }}
      allowedUnits={allowedUnits}
      min={min}
      max={max}
      step={step}
      allowNegative={allowNegative}
      placeholder={placeholder}
    />
  );
}

setWpsgDebugDisplayName(CssValueInput, 'CssValueInput');
