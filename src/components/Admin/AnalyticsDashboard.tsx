import { useState, useCallback } from 'react';
import useSWR from 'swr';
import {
  Stack,
  Group,
  Text,
  Title,
  Select,
  SegmentedControl,
  Paper,
  SimpleGrid,
  Center,
  Loader,
  Alert,
} from '@mantine/core';
import { IconChartLine, IconEye, IconUsers, IconInfoCircle } from '@tabler/icons-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { ApiClient, CampaignAnalyticsResponse } from '@/services/apiClient';

interface SelectItem {
  value: string;
  label: string;
}

interface AnalyticsDashboardProps {
  apiClient: ApiClient;
  campaigns: SelectItem[];
}

type RangePreset = '7' | '30' | '90';

function getDateRange(preset: RangePreset): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - parseInt(preset) + 1);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { from: fmt(from), to: fmt(to) };
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
      <Group mb="xs" gap="xs">
        {icon}
        <Text size="sm" c="dimmed" fw={500}>
          {label}
        </Text>
      </Group>
      <Title order={3}>
        {value === null ? '—' : value.toLocaleString()}
      </Title>
    </Paper>
  );
}

export function AnalyticsDashboard({ apiClient, campaigns }: AnalyticsDashboardProps) {
  const [campaignId, setCampaignId] = useState<string | null>(campaigns[0]?.value ?? null);
  const [preset, setPreset] = useState<RangePreset>('30');

  const fetcher = useCallback(
    async ([id, p]: [string, RangePreset]): Promise<CampaignAnalyticsResponse> => {
      const { from, to } = getDateRange(p);
      return apiClient.getCampaignAnalytics(id, from, to);
    },
    [apiClient],
  );

  const { data, isLoading, error } = useSWR<CampaignAnalyticsResponse>(
    campaignId ? [campaignId, preset] : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  const chartData = (data?.daily ?? []).map((d) => ({
    date: d.date.slice(5), // MM-DD
    Views: d.views,
    Unique: d.unique,
  }));

  return (
    <Stack gap="md">
      <Group justify="space-between" wrap="wrap" gap="sm">
        <Group gap="xs">
          <IconChartLine size={20} />
          <Title order={4}>Campaign Analytics</Title>
        </Group>
        <Group gap="sm" wrap="wrap">
          <Select
            placeholder="Select campaign"
            data={campaigns}
            value={campaignId}
            onChange={setCampaignId}
            w={220}
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
        </Group>
      </Group>

      {!campaignId && (
        <Alert icon={<IconInfoCircle size={16} />} color="blue">
          Select a campaign to view analytics.
        </Alert>
      )}

      {campaignId && (
        <>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            <StatCard
              label="Total Views"
              value={data?.total_views ?? null}
              icon={<IconEye size={18} color="var(--mantine-color-blue-5)" />}
            />
            <StatCard
              label="Unique Visitors"
              value={data?.unique_visitors ?? null}
              icon={<IconUsers size={18} color="var(--mantine-color-teal-5)" />}
            />
          </SimpleGrid>

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
                  <Tooltip
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
        </>
      )}
    </Stack>
  );
}
