import { Counter, Registry, collectDefaultMetrics } from 'prom-client';

type TransactionLike = { type?: string | null | undefined };

const registry = new Registry();
collectDefaultMetrics({
  register: registry,
  prefix: process.env.PROMETHEUS_METRIC_PREFIX ?? 'qzd_',
});

const transactionCounter = new Counter({
  name: 'qzd_transactions_total',
  help: 'Total number of transactions recorded by the demo ledger, labelled by kind.',
  labelNames: ['kind'],
  registers: [registry],
});

export const metricsContentType = registry.contentType;

export async function getMetricsSnapshot(): Promise<string> {
  return registry.metrics();
}

export function recordTransactionMetric(transaction: TransactionLike): void {
  const kind = transaction.type ?? 'unknown';
  transactionCounter.inc({ kind });
}
