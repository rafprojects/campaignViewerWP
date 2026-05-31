import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@/test/test-utils';
import { CompanyCombobox } from './CompanyCombobox';
import type { CompanyInfo } from '@/services/adminQuery';

const companies: CompanyInfo[] = [
  { id: 1, name: 'Acme Corp', slug: 'acme-corp', campaignCount: 3, activeCampaigns: 2, archivedCampaigns: 1, accessGrantCount: 0, campaigns: [] },
  { id: 2, name: 'Beta Ltd', slug: 'beta-ltd', campaignCount: 1, activeCampaigns: 1, archivedCampaigns: 0, accessGrantCount: 0, campaigns: [] },
];

describe('CompanyCombobox', () => {
  it('resolves slug to display name on mount', () => {
    render(<CompanyCombobox value="acme-corp" onChange={vi.fn()} companies={companies} />);
    expect(screen.getByDisplayValue('Acme Corp')).toBeInTheDocument();
  });

  it('filters by name substring', async () => {
    render(<CompanyCombobox value="" onChange={vi.fn()} companies={companies} />);
    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'acme' } });
    expect(await screen.findByRole('option', { name: 'Acme Corp' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Beta Ltd' })).not.toBeInTheDocument();
  });

  it('filters by slug substring', async () => {
    render(<CompanyCombobox value="" onChange={vi.fn()} companies={companies} />);
    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'beta-ltd' } });
    expect(await screen.findByRole('option', { name: 'Beta Ltd' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Acme Corp' })).not.toBeInTheDocument();
  });

  it('suppresses the Create option when typed value exactly matches an existing slug', async () => {
    render(<CompanyCombobox value="" onChange={vi.fn()} companies={companies} />);
    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'acme-corp' } });
    await screen.findByRole('option', { name: 'Acme Corp' });
    expect(screen.queryByText(/\+ Create/)).not.toBeInTheDocument();
  });

  it('suppresses the Create option when typed value exactly matches an existing name', async () => {
    render(<CompanyCombobox value="" onChange={vi.fn()} companies={companies} />);
    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Acme Corp' } });
    await screen.findByRole('option', { name: 'Acme Corp' });
    expect(screen.queryByText(/\+ Create/)).not.toBeInTheDocument();
  });

  it('shows the Create option for genuinely new input', async () => {
    render(<CompanyCombobox value="" onChange={vi.fn()} companies={companies} />);
    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'New Company' } });
    expect(await screen.findByText(/\+ Create/)).toBeInTheDocument();
  });

  it('calls onChange with the slug when selecting an existing company', async () => {
    const onChange = vi.fn();
    render(<CompanyCombobox value="" onChange={onChange} companies={companies} />);
    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Acme' } });
    const option = await screen.findByRole('option', { name: 'Acme Corp' });
    fireEvent.click(option);
    expect(onChange).toHaveBeenCalledWith('acme-corp');
  });

  it('calls onChange with the raw text when creating a new company', async () => {
    const onChange = vi.fn();
    render(<CompanyCombobox value="" onChange={onChange} companies={companies} />);
    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'New Startup' } });
    const createOption = await screen.findByText(/\+ Create/);
    fireEvent.click(createOption);
    expect(onChange).toHaveBeenCalledWith('New Startup');
  });
});
