import { useEffect, useMemo, useRef, useState } from 'react';
import { Combobox } from '@mantine/core';
import type { MantineSize } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import type { CompanyInfo } from '@/services/adminQuery';
import { SearchableEntityInput } from './SearchableEntityInput';

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
  placeholder,
}: CompanyComboboxProps) {
  const { t } = useTranslation('wpsg');
  const resolvedPlaceholder = placeholder ?? t('cc_placeholder', 'Search or add company…');
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
  };

  const handleBlur = () => {
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

  const handleInputChange = (next: string) => {
    setInputValue(next);
    committedRef.current = false;
  };

  return (
    <SearchableEntityInput
      displayValue={inputValue}
      onInputChange={handleInputChange}
      onOptionSubmit={handleOptionSubmit}
      onBlur={handleBlur}
      loading={loading}
      label={label}
      required={required}
      size={size}
      placeholder={resolvedPlaceholder}
    >
      {filtered.map((company) => (
        <Combobox.Option key={company.slug} value={company.slug}>
          {company.name}
        </Combobox.Option>
      ))}
      {!exactMatch && inputValue.trim() && (
        <Combobox.Option value={inputValue.trim()}>
          {t('cc_create', '+ Create “{{name}}”', { name: inputValue.trim() })}
        </Combobox.Option>
      )}
      {filtered.length === 0 && !inputValue.trim() && (
        <Combobox.Empty>{t('cc_no_companies', 'No companies found')}</Combobox.Empty>
      )}
    </SearchableEntityInput>
  );
}
