/**
 * P59-B Tests: TextPropertiesPanel — content, role, alignment, geometry,
 * z-order, remove, rename, and that the shared TypographyEditor is wired in.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { TextPropertiesPanel, type TextPropertiesPanelProps } from './TextPropertiesPanel';
import type { LayoutTextLayer } from '@/types';

const baseText: LayoutTextLayer = {
  id: 't1',
  x: 10,
  y: 20,
  width: 50,
  height: 15,
  zIndex: 5,
  opacity: 0.9,
  content: 'Summer Sale',
  semanticTag: 'heading',
  textAlign: 'left',
  typography: { fontSize: '28px', fontWeight: 600 },
  name: 'Headline',
};

function makeProps(overrides: Partial<TextPropertiesPanelProps> = {}): TextPropertiesPanelProps {
  return {
    text: baseText,
    textIndex: 1,
    onUpdate: vi.fn(),
    onRename: vi.fn(),
    onRemove: vi.fn(),
    onBringToFront: vi.fn(),
    onSendToBack: vi.fn(),
    onBringForward: vi.fn(),
    onSendBackward: vi.fn(),
    ...overrides,
  };
}

describe('TextPropertiesPanel', () => {
  it('renders the layer name in the name input', () => {
    render(<TextPropertiesPanel {...makeProps()} />);
    expect(screen.getByLabelText('Text layer name')).toHaveValue('Headline');
  });

  it('falls back to "Text Layer N" when name is absent', () => {
    const text = { ...baseText, name: undefined };
    render(<TextPropertiesPanel {...makeProps({ text, textIndex: 3 })} />);
    expect(screen.getByLabelText('Text layer name')).toHaveValue('Text Layer 3');
  });

  it('renders the content in the text area', () => {
    render(<TextPropertiesPanel {...makeProps()} />);
    expect(screen.getByLabelText('Text content')).toHaveValue('Summer Sale');
  });

  it('commits content on blur via onUpdate', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    render(<TextPropertiesPanel {...makeProps({ onUpdate })} />);
    const area = screen.getByLabelText('Text content');
    await user.clear(area);
    await user.type(area, 'New copy');
    await user.tab();
    expect(onUpdate).toHaveBeenCalledWith('t1', { content: 'New copy' });
  });

  it('renders X%, Y%, W%, H% with correct values', () => {
    render(<TextPropertiesPanel {...makeProps()} />);
    expect(screen.getByLabelText('X %')).toHaveValue('10');
    expect(screen.getByLabelText('Y %')).toHaveValue('20');
    expect(screen.getByLabelText('W %')).toHaveValue('50');
    expect(screen.getByLabelText('H %')).toHaveValue('15');
  });

  it('calls onUpdate with new x when X input changes', () => {
    const onUpdate = vi.fn();
    render(<TextPropertiesPanel {...makeProps({ onUpdate })} />);
    fireEvent.change(screen.getByLabelText('X %'), { target: { value: '25' } });
    expect(onUpdate).toHaveBeenCalledWith('t1', expect.objectContaining({ x: 25 }));
  });

  it('rotation and opacity sliders are present', () => {
    render(<TextPropertiesPanel {...makeProps()} />);
    expect(screen.getByLabelText('Rotation')).toBeInTheDocument();
    expect(screen.getByLabelText('Opacity')).toBeInTheDocument();
  });

  it('renders the semantic-role select bound to the current value', () => {
    render(<TextPropertiesPanel {...makeProps()} />);
    // The role Select is bound to semanticTag='heading' → displays "Heading (H2)".
    expect(screen.getByDisplayValue('Heading (H2)')).toBeInTheDocument();
  });

  it('changing the alignment calls onUpdate', () => {
    const onUpdate = vi.fn();
    render(<TextPropertiesPanel {...makeProps({ onUpdate })} />);
    const center = document.querySelector('input[value="center"]') as HTMLInputElement;
    expect(center).toBeTruthy();
    fireEvent.click(center);
    expect(onUpdate).toHaveBeenCalledWith('t1', { textAlign: 'center' });
  });

  it('reuses the shared TypographyEditor (typography controls present)', () => {
    render(<TextPropertiesPanel {...makeProps()} />);
    // "Letter Spacing" is a label unique to TypographyEditor — confirms it is wired in.
    expect(screen.getByText('Letter Spacing')).toBeInTheDocument();
  });

  it('z-order action buttons are present and wired', () => {
    const onBringToFront = vi.fn();
    const onSendToBack = vi.fn();
    render(<TextPropertiesPanel {...makeProps({ onBringToFront, onSendToBack })} />);
    fireEvent.click(screen.getByRole('button', { name: /bring to front/i }));
    fireEvent.click(screen.getByRole('button', { name: /send to back/i }));
    expect(onBringToFront).toHaveBeenCalledWith('t1');
    expect(onSendToBack).toHaveBeenCalledWith('t1');
  });

  it('remove shows confirm UI then calls onRemove', () => {
    const onRemove = vi.fn();
    render(<TextPropertiesPanel {...makeProps({ onRemove })} />);
    fireEvent.click(screen.getByRole('button', { name: /remove text layer/i }));
    expect(screen.getByText(/remove this text layer\?/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /confirm remove/i }));
    expect(onRemove).toHaveBeenCalledWith('t1');
  });

  it('calls onRename on blur when the name changed', async () => {
    const user = userEvent.setup();
    const onRename = vi.fn();
    render(<TextPropertiesPanel {...makeProps({ onRename })} />);
    const input = screen.getByLabelText('Text layer name');
    await user.clear(input);
    await user.type(input, 'CTA');
    await user.tab();
    expect(onRename).toHaveBeenCalledWith('t1', 'CTA');
  });
});
