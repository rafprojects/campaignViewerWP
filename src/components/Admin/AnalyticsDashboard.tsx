import { useCallback, useMemo, useState } from 'react';
import {
  ActionIcon,
  Alert,
  Badge,
  Center,
  Group,
  Loader,
  Paper,
  ScrollArea,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  IconChartLine,
  IconEye,
  IconInfoCircle,
  IconPhoto,
  IconRefresh,
  IconUsers,
  IconWifi,
} from '@tabler/icons-react';
import type { ApiClient } from '@/services/apiClient';
import {
  type AnalyticsPollingOptions,
  useAnalyticsSummary,
  useCampaignAnalytics,
  useCampaignMediaAnalytics,
} from '@/services/adminQuery';
import { useTabVisibility } from '@wp-super-gallery/shared-utils';
import { useOnlineStatus } from '@wp-super-gallery/shared-utils';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

interface SelectItem {
  value: string;
  label: string;
}

interface AnalyticsDashboardProps {
  apiClient: ApiClient;
  campaigns: SelectItem[];
  /**
   * P53-A: the all-campaigns summary (totals + top campaigns) is
   * require_system_admin. Editors see only the per-campaign view.
   */
  isSystemAdmin?: boolean;
}

type RangePreset = '7' | '30' | '90';

function getDateRange(preset: RangePreset): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - parseInt(preset) + 1);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { from: fmt(from), to: fmt(to) };
}

/** Format a Unix-ms timestamp as a locale time string, or '' when zero. */
function formatUpdatedAt(ts: number): string {
  if (ts === 0) return '';
  return new Date(ts).toLocaleTimeString();
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | null;
  icon: React.ReactNode;
}) {
  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap={4} mb="xs">
        {icon}
        <Text size="sm" c="dimmed" fw={500}>
          {label}
        </Text>
      </Stack>
      <Title order={3}>
        {value === null ? '—' : value.toLocaleString()}
      </Title>
    </Paper>
  );
}

setWpsgDebugDisplayName(StatCard, 'AdminPanel:StatCard');

export function AnalyticsDashboard({ apiClient, campaigns, isSystemAdmin = false }: AnalyticsDashboardProps) {
  const [campaignId, setCampaignId] = useState<string | null>(campaigns[0]?.value ?? null);
  const [preset, setPreset] = useState<RangePreset>('30');
  const dateRange = useMemo(() => getDateRange(preset), [preset]);

  // P34-A: visibility-aware polling
  const isTabVisible = useTabVisibility();
  const isOnline = useOnlineStatus();
  const pollingOptions = useMemo<AnalyticsPollingOptions>(
    () => ({ enabled: isTabVisible && isOnline }),
    [isTabVisible, isOnline],
  );

  const {
    data,
    isLoading,
    error,
    dataUpdatedAt,
    refetch: refetchAnalytics,
  } = useCampaignAnalytics(
    apiClient,
    campaignId,
    dateRange.from,
    dateRange.to,
    pollingOptions,
  );

  const {
    data: summaryData,
    dataUpdatedAt: summaryUpdatedAt,
    refetch: refetchSummary,
  } = useAnalyticsSummary(
    apiClient,
    'all',
    dateRange.from,
    dateRange.to,
    isSystemAdmin,
    pollingOptions,
  );

  const {
    data: mediaData,
    isLoading: mediaLoading,
    dataUpdatedAt: mediaUpdatedAt,
    refetch: refetchMedia,
  } = useCampaignMediaAnalytics(
    apiClient,
    campaignId,
    dateRange.from,
    dateRange.to,
    pollingOptions,
  );

  // Oldest non-zero timestamp = last time all queries were fresh simultaneously
  const lastUpdatedAt = useMemo(() => {
    const times = [dataUpdatedAt, summaryUpdatedAt, mediaUpdatedAt].filter((t) => t > 0);
    return times.length > 0 ? Math.min(...times) : 0;
  }, [dataUpdatedAt, summaryUpdatedAt, mediaUpdatedAt]);

  const handleRefreshAll = useCallback(() => {
    void refetchAnalytics();
    // A manual refetch ignores `enabled`, so only refresh the summary for a
    // system admin (otherwise it would hit the require_system_admin endpoint).
    if (isSystemAdmin) void refetchSummary();
    void refetchMedia();
  }, [refetchAnalytics, refetchSummary, refetchMedia, isSystemAdmin]);

  const chartData = (data?.daily ?? []).map((d) => ({
    date: d.date.slice(5),
    Views: d.views,
    Unique: d.unique,
  }));

  const mediaItems = mediaData?.items ?? [];

  return (
    <Stack gap="md">
      {/* ── Summary strip ─────────────────────────────────────────────────── */}
      {/* P53-A: the "all campaigns" totals are system-admin only; editors see
          only the selected-campaign stats. */}
      <SimpleGrid cols={{ base: 2, sm: isSystemAdmin ? 4 : 2 }} spacing="sm">
        {isSystemAdmin && (
          <>
            <StatCard
              label="Total Views (all campaigns)"
              value={summaryData?.totalViews ?? null}
              icon={<IconEye size={18} color="var(--mantine-color-blue-5)" />}
            />
            <StatCard
              label="Unique Visitors (all campaigns)"
              value={summaryData?.uniqueVisitors ?? null}
              icon={<IconUsers size={18} color="var(--mantine-color-teal-5)" />}
            />
          </>
        )}
        <StatCard
          label="Views (selected campaign)"
          value={data?.totalViews ?? null}
          icon={<IconEye size={18} color="var(--mantine-color-violet-5)" />}
        />
        <StatCard
          label="Unique (selected campaign)"
          value={data?.uniqueVisitors ?? null}
          icon={<IconUsers size={18} color="var(--mantine-color-orange-5)" />}
        />
      </SimpleGrid>

      {/* ── Controls ──────────────────────────────────────────────────────── */}
      <Stack gap="xs">
        <Group justify="space-between" align="center">
          <Title order={4} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconChartLine size={20} />
            Campaign Analytics
          </Title>
          {/* P34-A: refresh affordance + freshness indicator */}
          <Group gap="xs" align="center">
            {!isOnline && (
              <Badge
                size="xs"
                color="red"
                leftSection={<IconWifi size={10} />}
                aria-label="Browser is offline — polling paused"
              >
                Offline
              </Badge>
            )}
            {lastUpdatedAt > 0 && (
              <Text size="xs" c="dimmed" aria-live="polite">
                Updated {formatUpdatedAt(lastUpdatedAt)}
              </Text>
            )}
            <Tooltip label="Refresh analytics" withArrow>
              <ActionIcon
                variant="subtle"
                size="sm"
                onClick={handleRefreshAll}
                loading={isLoading}
                aria-label="Refresh analytics"
              >
                <IconRefresh size={14} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <Select
            placeholder="Select campaign"
            data={campaigns}
            value={campaignId}
            onChange={setCampaignId}
            size="sm"
            clearable={false}
          />
          <SegmentedControl
            size="sm"
            value={preset}
            onChange={(v) => setPreset(v as RangePreset)}
            data={[
              { label: 'Last 7d', value: '7' },
              { label: 'Last 30d', value: '30' },
              { label: 'Last 90d', value: '90' },
            ]}
          />
        </SimpleGrid>
      </Stack>

      {!campaignId && (
        <Alert icon={<IconInfoCircle size={16} />} color="blue">
          Select a campaign to view per-campaign analytics.
        </Alert>
      )}

      {campaignId && (
        <>
          {/* ── Daily chart ───────────────────────────────────────────────── */}
          {isLoading && (
            <Center py="xl">
              <Loader size="sm" />
            </Center>
          )}

          {error && (
            <Alert icon={<IconInfoCircle size={16} />} color="red">
              Failed to load analytics data.
            </Alert>
          )}

          {!isLoading && !error && chartData.length === 0 && (
            <Paper withBorder p="xl" radius="md">
              <Center>
                <Stack align="center" gap="xs">
                  <IconChartLine size={32} color="var(--mantine-color-dimmed)" />
                  <Text c="dimmed" size="sm">
                    No view events recorded for this period.
                  </Text>
                  <Text c="dimmed" size="xs">
                    Make sure <strong>Enable Analytics</strong> is turned on in Settings → Advanced.
                  </Text>
                </Stack>
              </Center>
            </Paper>
          )}

          {!isLoading && !error && chartData.length > 0 && (
            <Paper withBorder p="md" radius="md">
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--mantine-color-default-border)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12, fill: 'var(--mantine-color-dimmed)' }}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: 'var(--mantine-color-dimmed)' }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <ChartTooltip
                    contentStyle={{
                      background: 'var(--mantine-color-body)',
                      border: '1px solid var(--mantine-color-default-border)',
                      borderRadius: 8,
                      fontSize: 13,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 13 }} />
                  <Line
                    type="monotone"
                    dataKey="Views"
                    stroke="var(--mantine-color-blue-5)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="Unique"
                    stroke="var(--mantine-color-teal-5)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Paper>
          )}

          {/* ── Media Performance table ──────────────────────────────────── */}
          <Paper withBorder p="md" radius="md">
            <Stack gap="sm">
              <Title order={5} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <IconPhoto size={16} />
                Media Performance
              </Title>
              {mediaLoading && (
                <Center py="md">
                  <Loader size="xs" />
                </Center>
              )}
              {!mediaLoading && mediaItems.length === 0 && (
                <Text size="sm" c="dimmed">
                  No per-media events recorded for this period. Lightbox interactions with media IDs will appear here.
                </Text>
              )}
              {!mediaLoading && mediaItems.length > 0 && (
                <ScrollArea>
                  <Table striped highlightOnHover withTableBorder withColumnBorders fz="sm">
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Media ID</Table.Th>
                        <Table.Th style={{ textAlign: 'right' }}>Views</Table.Th>
                        <Table.Th style={{ textAlign: 'right' }}>Lightbox Opens</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {mediaItems.map((item) => (
                        <Table.Tr key={item.media_id}>
                          <Table.Td>
                            <Text size="xs" ff="monospace">{item.media_id}</Text>
                          </Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>
                            <Badge variant="light" color="blue" size="sm">{item.views.toLocaleString()}</Badge>
                          </Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>
                            <Badge variant="light" color="teal" size="sm">{item.lightbox_opens.toLocaleString()}</Badge>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </ScrollArea>
              )}
            </Stack>
          </Paper>

          {/* ── Top campaigns table (system-admin only, P53-A) ────────────── */}
          {isSystemAdmin && (summaryData?.topCampaigns?.length ?? 0) > 0 && (
            <Paper withBorder p="md" radius="md">
              <Stack gap="sm">
                <Title order={5} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <IconChartLine size={16} />
                  Top Campaigns by Views
                </Title>
                <Table striped highlightOnHover withTableBorder withColumnBorders fz="sm">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>#</Table.Th>
                      <Table.Th>Campaign</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>Views</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {summaryData!.topCampaigns.map((c, i) => (
                      <Table.Tr key={c.id}>
                        <Table.Td c="dimmed">{i + 1}</Table.Td>
                        <Table.Td>{c.title}</Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          <Badge variant="light" color="blue" size="sm">{c.views.toLocaleString()}</Badge>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Stack>
            </Paper>
          )}
        </>
      )}
    </Stack>
  );
}

setWpsgDebugDisplayName(AnalyticsDashboard, 'AdminPanel:AnalyticsDashboard');
