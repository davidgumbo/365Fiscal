export interface RevenueTrendInvoice {
  invoice_date?: string | null;
  created_at?: string | null;
  fiscalized_at?: string | null;
  total_amount?: number | null;
}

export interface RevenueTrendBar {
  key: string;
  label: string;
  value: number;
  heightPercent: number;
}

export interface RevenueTrendChart {
  bars: RevenueTrendBar[];
  axisTicks: number[];
  axisSteps: number;
  totalRevenue: number;
  latestValue: number;
  latestLabel: string;
}

interface BuildRevenueTrendChartOptions {
  invoices: RevenueTrendInvoice[];
  from?: string;
  to?: string;
  axisSteps?: number;
}

const niceNumber = (value: number, round: boolean): number => {
  if (value <= 0) return 0;
  const exponent = Math.floor(Math.log10(value));
  const base = 10 ** exponent;
  const fraction = value / base;

  let niceFraction;
  if (round) {
    if (fraction < 1.5) niceFraction = 1;
    else if (fraction < 3) niceFraction = 2;
    else if (fraction < 7) niceFraction = 5;
    else niceFraction = 10;
  } else {
    if (fraction <= 1) niceFraction = 1;
    else if (fraction <= 2) niceFraction = 2;
    else if (fraction <= 5) niceFraction = 5;
    else niceFraction = 10;
  }

  return niceFraction * base;
};

const getInvoiceEffectiveDate = (invoice: RevenueTrendInvoice): Date | null => {
  if (invoice.fiscalized_at) return new Date(invoice.fiscalized_at);
  if (invoice.invoice_date) return new Date(invoice.invoice_date);
  if (invoice.created_at) return new Date(invoice.created_at);
  return null;
};

const formatTrendLabel = (key: string, isMonthly: boolean) => {
  const parts = key.split("-");
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = isMonthly ? 1 : Number(parts[2]);
  const date = new Date(year, month, Number.isNaN(day) ? 1 : day);
  if (Number.isNaN(date.getTime())) return key;
  return isMonthly
    ? date.toLocaleString("default", { month: "short", year: "numeric" })
    : date.toLocaleString("default", { month: "short", day: "numeric" });
};

export const buildRevenueTrendChart = ({
  invoices,
  from,
  to,
  axisSteps = 4,
}: BuildRevenueTrendChartOptions): RevenueTrendChart => {
  const safeAxisSteps = Math.max(1, axisSteps);
  const emptyChart = {
    bars: [],
    axisTicks: [],
    axisSteps: safeAxisSteps,
    totalRevenue: 0,
    latestValue: 0,
    latestLabel: "",
  };

  if (!from || !to) {
    return emptyChart;
  }

  const startDate = new Date(from);
  const endDate = new Date(`${to}T23:59:59`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return emptyChart;
  }
  if (startDate > endDate) {
    return emptyChart;
  }

  const diffDays = Math.max(
    1,
    Math.ceil(
      (endDate.getTime() - startDate.getTime() + 1) / (1000 * 60 * 60 * 24),
    ),
  );
  const isMonthly = diffDays > 90;
  const buildKey = (date: Date) =>
    isMonthly
      ? `${date.getFullYear()}-${date.getMonth()}`
      : `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

  const buckets = new Map<string, number>();
  if (isMonthly) {
    let cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    while (cursor <= endDate) {
      buckets.set(buildKey(cursor), 0);
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
  } else {
    let cursor = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate(),
    );
    while (cursor <= endDate) {
      buckets.set(buildKey(cursor), 0);
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  invoices.forEach((invoice) => {
    const date = getInvoiceEffectiveDate(invoice);
    if (!date || date < startDate || date > endDate) {
      return;
    }
    const key = buildKey(date);
    buckets.set(key, (buckets.get(key) || 0) + (invoice.total_amount || 0));
  });

  const basePoints = Array.from(buckets.entries()).map(([key, value]) => ({
    key,
    value,
    label: formatTrendLabel(key, isMonthly),
  }));

  const maxValue = Math.max(1, ...basePoints.map((point) => point.value));
  const totalRevenue = basePoints.reduce((sum, point) => sum + point.value, 0);

  const rawStep = safeAxisSteps ? maxValue / safeAxisSteps : maxValue || 1;
  const stepSize = niceNumber(rawStep, false) || 1;
  const axisMax = stepSize * safeAxisSteps;
  const axisTicks =
    axisMax === 0
      ? Array(safeAxisSteps + 1).fill(0)
      : Array.from(
          { length: safeAxisSteps + 1 },
          (_, idx) => stepSize * (safeAxisSteps - idx),
        );

  const referenceValue = axisMax || 1;
  const bars = basePoints.map((point) => ({
    ...point,
    heightPercent:
      referenceValue > 0
        ? Math.max(1, (point.value / referenceValue) * 100)
        : 0,
  }));

  const latestPoint = bars[bars.length - 1];

  return {
    bars,
    axisTicks,
    axisSteps: safeAxisSteps,
    totalRevenue,
    latestValue: latestPoint?.value || 0,
    latestLabel: latestPoint?.label || "",
  };
};
