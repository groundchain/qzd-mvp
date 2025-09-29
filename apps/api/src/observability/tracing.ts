import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR);

let sdk: NodeSDK | undefined;
let initialized = false;

export async function initializeTracing(): Promise<void> {
  if (initialized || process.env.NODE_ENV === 'test' || process.env.DISABLE_TRACING === '1') {
    initialized = true;
    return;
  }

  const serviceName = process.env.OTEL_SERVICE_NAME ?? 'qzd-api';
  const traceExporter = new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
  });

  sdk = new NodeSDK({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
      [SemanticResourceAttributes.SERVICE_NAMESPACE]: process.env.OTEL_SERVICE_NAMESPACE ?? 'qzd',
    }),
    traceExporter,
    instrumentations: [getNodeAutoInstrumentations()],
  });

  try {
    await sdk.start();
    initialized = true;
  } catch (error) {
    initialized = true;
    console.error('Failed to initialize OpenTelemetry tracing', error);
  }
}

export async function shutdownTracing(): Promise<void> {
  if (!sdk) {
    return;
  }

  try {
    await sdk.shutdown();
  } catch (error) {
    console.error('Failed to shutdown OpenTelemetry tracing', error);
  }
}
