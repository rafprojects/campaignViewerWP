import { useEffect, useMemo, useState } from 'react';
import { Combobox, Loader, TextInput, useCombobox } from '@mantine/core';
import type { MantineSize } from '@mantine/core';
import type { CompanyInfo } from '@/services/adminQuery';

export interface CompanyComboboxProps {
  /** Company slug (for existing) or name (for new/freeform). */
  value: string;
  onChange: (value: string) => void;
  companies: CompanyInfo[];
  loading?: boolean;
  label?: string | undefined;
  required?: boolean | undefined;
  size?: MantineSize | undefined;
  placeholder?: string | undefined;
}

export function CompanyCombobox({
  value,
  onChange,
  companies,
  loading,
  label = 'Company',
  required,
  size,
  placeholder = 'Search or add company…',
}: CompanyComboboxProps) {
  const combobox = useCombobox({ onDropdownClose: () => combobox.resetSelectedOption() });

  const resolveDisplay = (v: string) => {
    const match = companies.find((c) => c.slug === v);
    return match ? match.name : v;
  };

  const [inputValue, setInputValue] = useState(() => resolveDisplay(value));

  // Keep display in sync when companies load after mount or value changes externally.
  useEffect(() => {
    setInputValue(resolveDisplay(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, companies]);

  const filtered = useMemo(
    () => companies.filter((c) => c.name.toLowerCase().includes(inputValue.toLowerCase())),
    [companies, inputValue],
  );

  const exactMatch = useMemo(
    () => companies.some((c) => c.name.toLowerCase() === inputValue.toLowerCase()),
    [companies, inputValue],
  );

  const handleOptionSubmit = (optionValue: string) => {
    onChange(optionValue);
    const match = companies.find((c) => c.slug === optionValue);
    setInputValue(match ? match.name : optionValue);
    combobox.closeDropdown();
  };

  return (
    <Combobox store={combobox} onOptionSubmit={handleOptionSubmit}>
      <Combobox.Target>
        <TextInput
          label={label}
          required={required ?? false}
          {...(size !== undefined && { size })}
          value={inputValue}
          placeholder={placeholder ?? 'Search or add company…'}
          rightSection={loading ? <Loader size="xs" /> : <Combobox.Chevron />}
          rightSectionPointerEvents="none"
          onChange={(e) => {
            const next = e.currentTarget.value;
            setInputValue(next);
            onChange(next);
            combobox.openDropdown();
            combobox.updateSelectedOptionIndex();
          }}
          onFocus={() => combobox.openDropdown()}
          onBlur={() => combobox.closeDropdown()}
          onClick={() => combobox.openDropdown()}
        />
      </Combobox.Target>

      <Combobox.Dropdown>
        <Combobox.Options>
          {filtered.map((company) => (
            <Combobox.Option key={company.slug} value={company.slug}>
              {company.name}
            </Combobox.Option>
          ))}
          {!exactMatch && inputValue.trim() && (
            <Combobox.Option value={inputValue.trim()}>
              + Create &ldquo;{inputValue.trim()}&rdquo;
            </Combobox.Option>
          )}
          {filtered.length === 0 && !inputValue.trim() && (
            <Combobox.Empty>No companies found</Combobox.Empty>
          )}
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}
