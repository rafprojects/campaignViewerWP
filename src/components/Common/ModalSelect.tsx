import { Select, type SelectProps } from '@mantine/core';
import { setMullionDebugDisplayName } from '@/utils/mullionDebug';

export function ModalSelect(props: SelectProps) {
  const { comboboxProps, ...restSelectProps } = props;

  return (
    <Select
      comboboxProps={{ ...comboboxProps, withinPortal: false }}
      {...restSelectProps}
    />
  );
}

setMullionDebugDisplayName(ModalSelect, 'ModalSelect');