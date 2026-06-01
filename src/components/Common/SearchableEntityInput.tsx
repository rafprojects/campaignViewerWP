import { useEffect, useRef } from 'react';
import { ActionIcon, Combobox, Loader, TextInput, useCombobox } from '@mantine/core';
import type { MantineSize } from '@mantine/core';
import { IconSearch, IconTrash } from '@tabler/icons-react';

export interface SearchableEntityInputProps {
  displayValue: string;
  onInputChange: (value: string) => void;
  onOptionSubmit: (value: string) => void;
  children: React.ReactNode;
  hasSelection?: boolean | undefined;
  onClear?: (() => void) | undefined;
  loading?: boolean | undefined;
  onBlur?: (() => void) | undefined;
  label?: React.ReactNode | undefined;
  placeholder?: string | undefined;
  required?: boolean | undefined;
  size?: MantineSize | undefined;
}

export function SearchableEntityInput({
  displayValue,
  onInputChange,
  onOptionSubmit,
  children,
  hasSelection,
  onClear,
  loading,
  onBlur,
  label,
  placeholder,
  required,
  size,
}: SearchableEntityInputProps) {
  const combobox = useCombobox({ onDropdownClose: () => combobox.resetSelectedOption() });
  const blurTimeoutRef = useRef<number | null>(null);
  // Prevents onBlur from firing after an option was committed via selection.
  const committedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    };
  }, []);

  const handleOptionSubmit = (val: string) => {
    committedRef.current = true;
    combobox.closeDropdown();
    onOptionSubmit(val);
  };

  return (
    <Combobox store={combobox} onOptionSubmit={handleOptionSubmit}>
      <Combobox.Target>
        <TextInput
          label={label}
          placeholder={placeholder}
          required={required ?? false}
          {...(size !== undefined && { size })}
          value={displayValue}
          rightSection={
            hasSelection ? (
              <ActionIcon
                size="sm"
                variant="subtle"
                aria-label="Clear selection"
                onClick={onClear}
              >
                <IconTrash size={14} />
              </ActionIcon>
            ) : loading ? (
              <Loader size={16} />
            ) : (
              <IconSearch size={16} />
            )
          }
          rightSectionPointerEvents={hasSelection ? 'auto' : 'none'}
          onChange={(e) => {
            committedRef.current = false;
            onInputChange(e.currentTarget.value);
            combobox.openDropdown();
            combobox.updateSelectedOptionIndex();
          }}
          onClick={() => combobox.openDropdown()}
          onFocus={() => combobox.openDropdown()}
          onBlur={() => {
            // Call consumer's onBlur synchronously so blur-resolution logic
            // (e.g. CompanyCombobox slug resolution) fires without a delay.
            if (!committedRef.current) onBlur?.();
            committedRef.current = false;
            // Delay dropdown close to avoid interfering with Combobox.Option
            // mousedown events in environments where blur fires first.
            if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
            blurTimeoutRef.current = window.setTimeout(() => {
              combobox.closeDropdown();
              blurTimeoutRef.current = null;
            }, 150);
          }}
        />
      </Combobox.Target>

      <Combobox.Dropdown>
        <Combobox.Options>{children}</Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}
