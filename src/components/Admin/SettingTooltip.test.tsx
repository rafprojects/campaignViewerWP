/**
 * Tests for SettingTooltip — covers the enabled/disabled branches (line 13).
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test/test-utils';
import { SettingTooltip } from './SettingTooltip';

describe('SettingTooltip', () => {
  it('renders only the label when enabled is false (line 13 true branch)', () => {
    render(<SettingTooltip label="My Setting" tooltip="Help text" enabled={false} />);
    expect(screen.getByText('My Setting')).toBeDefined();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders label and tooltip icon when enabled is true (line 13 false branch)', () => {
    render(<SettingTooltip label="My Setting" tooltip="Help text" enabled={true} />);
    expect(screen.getByText('My Setting')).toBeDefined();
    expect(screen.getByRole('button')).toBeDefined();
  });
});
