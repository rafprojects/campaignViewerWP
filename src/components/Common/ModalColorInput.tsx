import { ColorInput, type ColorInputProps } from '@mantine/core';

/**
 * Modal/drawer-safe ColorInput wrapper.
 *
 * Forces `popoverProps.withinPortal = false` so the color picker renders
 * inside the current shadow DOM / drawer / modal tree instead of escaping
 * to document.body where it would be invisible or unclickable.
 *
 * Mirrors the existing ModalSelect pattern.
 */
export function ModalColorInput(props: ColorInputProps) {
  const { popoverProps, ...restProps } = props;

  return (
    <ColorInput
      {...restProps}
      popoverProps={{ ...popoverProps, withinPortal: false }}
    />
  );
}
