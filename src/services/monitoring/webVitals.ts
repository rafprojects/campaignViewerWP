type VitalName = 'LCP' | 'CLS' | 'INP' | 'FID';

type LayoutShiftEntry = PerformanceEntry & {
  value: number;
  hadRecentInput: boolean;
};

type EventTimingEntry = PerformanceEntry & {
  duration: number;
  processingStart: number;
  startTime: number;
};

type VitalMetric = {
  name: VitalName;
  value: number;
  id: string;
  delta?: number;
  entries?: PerformanceEntry[];
};

type WebVitalsOptions = {
  sampleRate?: number;
  report?: (metric: VitalMetric) => void;
};

const vitalsBuffer: VitalMetric[] = [];

const getId = (name: VitalName) => `${name}-${Math.random().toString(36).slice(2, 10)}`;

const defaultReport = (metric: VitalMetric) => {
  vitalsBuffer.push(metric);
  if (typeof window !== 'undefined') {
    (window as Window & { __WPSG_VITALS__?: VitalMetric[] }).__WPSG_VITALS__ = vitalsBuffer;
  }
  console.info('[WPSG][Vitals]', metric.name, metric.value.toFixed(2));
};

const shouldSample = (sampleRate: number) => {
  if (sampleRate >= 1) return true;
  return Math.random() < sampleRate;
};

export function startWebVitalsMonitoring(options: WebVitalsOptions = {}) {
  if (typeof window === 'undefined') return;
  if (typeof PerformanceObserver === 'undefined') return;

  const sampleRate = options.sampleRate ?? 1;
  if (!shouldSample(sampleRate)) return;

  const report = options.report ?? defaultReport;

  let lcpEntry: PerformanceEntry | null = null;
  let clsValue = 0;
  let inpValue = 0;
  let fidValue = 0;

  const onVisibilityChange = () => {
    if (document.visibilityState !== 'hidden') return;

    if (lcpEntry) {
      report({ name: 'LCP', value: lcpEntry.startTime, id: getId('LCP'), entries: [lcpEntry] });
    }
    report({ name: 'CLS', value: clsValue, id: getId('CLS') });

    if (inpValue > 0) {
      report({ name: 'INP', value: inpValue, id: getId('INP') });
    } else if (fidValue > 0) {
      report({ name: 'FID', value: fidValue, id: getId('FID') });
    }
  };

  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('pagehide', onVisibilityChange);

  const supportedTypes = PerformanceObserver.supportedEntryTypes || [];

  if (supportedTypes.includes('largest-contentful-paint')) {
    const lcpObserver = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      if (entries.length > 0) {
        lcpEntry = entries[entries.length - 1];
      }
    });
    try {
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch {
      // Ignore unsupported configuration
    }
  }

  if (supportedTypes.includes('layout-shift')) {
    const clsObserver = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries() as LayoutShiftEntry[]) {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
        }
      }
    });
    try {
      clsObserver.observe({ type: 'layout-shift', buffered: true });
    } catch {
      // Ignore unsupported configuration
    }
  }

  if (supportedTypes.includes('event')) {
    const inpObserver = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries() as EventTimingEntry[]) {
        if (entry.duration > inpValue) {
          inpValue = entry.duration;
        }
      }
    });
    try {
      inpObserver.observe({ type: 'event', buffered: true });
    } catch {
      // Ignore unsupported configuration
    }
  }

  if (supportedTypes.includes('first-input')) {
    const fidObserver = new PerformanceObserver((entryList) => {
      const entry = entryList.getEntries()[0] as EventTimingEntry | undefined;
      if (entry) {
        fidValue = entry.processingStart - entry.startTime;
      }
    });
    try {
      fidObserver.observe({ type: 'first-input', buffered: true });
    } catch {
      // Ignore unsupported configuration
    }
  }
}
