import { useCallback } from 'react';
import { ModalColorInput } from '@/components/Common/ModalColorInput';
import type { ColorInputProps } from '@mantine/core';
import { useBuilderDock } from './BuilderDockContext';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

/**
 * Builder-specific ColorInput wrapper.
 *
 * Extends ModalColorInput with:
 * - Saved color swatches from workspace prefs (recently-used palette, persisted per root).
 * - EyeDropper button via Mantine's built-in withEyeDropper (no-op where unsupported).
 * - Auto-saves any valid color change to the shared swatch list.
 *
 * Drop-in replacement for ModalColorInput inside the LayoutBuilder panels.
 */
export function BuilderColorInput({ onChangeEnd, withEyeDropper = true, ...rest }: ColorInputProps) {
  const { savedSwatches, addSwatch } = useBuilderDock();

  // Save the swatch only when the interaction ends (mouse-up on the picker or
  // blur after typing a complete value), not on every incremental drag tick.
  const handleChangeEnd = useCallback(
    (value: string) => {
      onChangeEnd?.(value);
      if (value.trim() && value.trim() !== '#') addSwatch(value);
    },
    [onChangeEnd, addSwatch],
  );

  return (
    <ModalColorInput
      {...rest}
      swatches={savedSwatches}
      withEyeDropper={withEyeDropper}
      onChangeEnd={handleChangeEnd}
    />
  );
}

setWpsgDebugDisplayName(BuilderColorInput, 'LayoutBuilder:BuilderColorInput');
