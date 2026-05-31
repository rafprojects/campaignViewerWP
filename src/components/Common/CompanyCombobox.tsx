import { useEffect, useMemo, useRef, useState } from 'react';
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
  label,
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
  // Track whether the current value was committed via option selection so
  // blur doesn't fire a duplicate onChange.
  const committedRef = useRef(true);

  // Keep display in sync when companies load after mount or value changes externally.
  useEffect(() => {
    setInputValue(resolveDisplay(value));
    committedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, companies]);

  const filtered = useMemo(() => {
    const q = inputValue.toLowerCase();
    return companies.filter((c) => c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q));
  }, [companies, inputValue]);

  const exactMatch = useMemo(() => {
    const q = inputValue.toLowerCase();
    return companies.some((c) => c.name.toLowerCase() === q || c.slug.toLowerCase() === q);
  }, [companies, inputValue]);

  const handleOptionSubmit = (optionValue: string) => {
    const match = companies.find((c) => c.slug === optionValue);
    setInputValue(match ? match.name : optionValue);
    committedRef.current = true;
    onChange(optionValue);
    combobox.closeDropdown();
  };

  const handleBlur = () => {
    combobox.closeDropdown();
    if (!committedRef.current) {
      committedRef.current = true;
      const trimmed = inputValue.trim();
      // Resolve to slug if the text matches an existing company name or slug.
      const match = companies.find(
        (c) => c.name.toLowerCase() === trimmed.toLowerCase() || c.slug.toLowerCase() === trimmed.toLowerCase(),
      );
      onChange(match ? match.slug : trimmed);
    }
  };

  return (
    <Combobox store={combobox} onOptionSubmit={handleOptionSubmit}>
      <Combobox.Target>
        <TextInput
          label={label}
          required={required ?? false}
          {...(size !== undefined && { size })}
          value={inputValue}
          placeholder={placeholder}
          rightSection={loading ? <Loader size="xs" /> : null}
          onChange={(e) => {
            const next = e.currentTarget.value;
            setInputValue(next);
            committedRef.current = false;
            combobox.openDropdown();
            combobox.updateSelectedOptionIndex();
          }}
          onBlur={handleBlur}
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
