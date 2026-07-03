import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, NumberInput, Switch, Button, Stack, Group, Text } from '@mantine/core';
import { computeGridSlots } from '@wp-super-gallery/shared-utils';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

export interface AutoGridDialogProps {
  opened: boolean;
  onClose: () => void;
  /** Generate the grid. Slots are created as a single undo entry by the caller. */
  onGenerate: (opts: { rows: number; cols: number; gapPct: number; marginPct: number; replace: boolean }) => void;
  /** Whether the canvas already has slots (shows the "Replace existing" toggle). */
  hasExistingSlots?: boolean;
}

function toNum(v: string | number, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

/**
 * P58-F — Auto-grid generator. Lets the user lay down an evenly-spaced N×M grid
 * of slots in one action, with a live preview driven by the same `computeGridSlots`
 * geometry used to generate them.
 */
export function AutoGridDialog({ opened, onClose, onGenerate, hasExistingSlots = false }: AutoGridDialogProps) {
  const { t } = useTranslation('wpsg');
  const [rows, setRows] = useState(2);
  const [cols, setCols] = useState(3);
  const [gapPct, setGapPct] = useState(2);
  const [marginPct, setMarginPct] = useState(2);
  const [replace, setReplace] = useState(false);

  const cells = computeGridSlots(rows, cols, gapPct, marginPct);
  const canGenerate = cells.length > 0;

  const handleGenerate = () => {
    if (!canGenerate) return;
    onGenerate({ rows, cols, gapPct, marginPct, replace });
    onClose();
  };

  return (
    <Modal opened={opened} onClose={onClose} title={t('lb_grid_title', 'Generate grid')} size="md" aria-label={t('lb_grid_aria', 'Auto-grid generator')}>
      <Stack gap="md">
        <Group grow>
          <NumberInput label={t('lb_grid_rows', 'Rows')} value={rows} onChange={(v) => setRows(toNum(v, rows))} min={1} max={20} allowDecimal={false} />
          <NumberInput label={t('lb_grid_cols', 'Columns')} value={cols} onChange={(v) => setCols(toNum(v, cols))} min={1} max={20} allowDecimal={false} />
        </Group>
        <Group grow>
          <NumberInput label={t('lb_grid_gap', 'Gap (%)')} value={gapPct} onChange={(v) => setGapPct(toNum(v, gapPct))} min={0} max={20} step={0.5} />
          <NumberInput label={t('lb_grid_margin', 'Margin (%)')} value={marginPct} onChange={(v) => setMarginPct(toNum(v, marginPct))} min={0} max={20} step={0.5} />
        </Group>

        {hasExistingSlots && (
          <Switch
            label={t('lb_grid_replace', 'Replace existing slots')}
            checked={replace}
            onChange={(e) => setReplace(e.currentTarget.checked)}
          />
        )}

        {/* Live preview — same geometry as generation */}
        <div>
          <Text size="xs" c="dimmed" mb={4}>
            {t('lb_grid_preview', 'Preview ({{count}} slot)', { count: cells.length })}
          </Text>
          <div
            style={{
              position: 'relative',
              width: '100%',
              aspectRatio: '16 / 9',
              background: 'var(--mantine-color-default-hover)',
              border: '1px solid var(--mantine-color-default-border)',
              borderRadius: 4,
              overflow: 'hidden',
            }}
          >
            {cells.map((cell, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: `${cell.x}%`,
                  top: `${cell.y}%`,
                  width: `${cell.width}%`,
                  height: `${cell.height}%`,
                  background: 'var(--mantine-color-blue-5)',
                  opacity: 0.5,
                  borderRadius: 2,
                }}
              />
            ))}
          </div>
          {!canGenerate && (
            <Text size="xs" c="red" mt={4}>
              {t('lb_grid_no_room', 'These settings leave no room for cells — reduce the gap or margin.')}
            </Text>
          )}
        </div>

        <Group justify="flex-end" mt="xs">
          <Button variant="default" onClick={onClose}>{t('lb_grid_cancel', 'Cancel')}</Button>
          <Button onClick={handleGenerate} disabled={!canGenerate}>{t('lb_grid_generate', 'Generate')}</Button>
        </Group>
      </Stack>
    </Modal>
  );
}

setWpsgDebugDisplayName(AutoGridDialog, 'LayoutBuilder:AutoGridDialog');
