import { MetricReader } from "@opentelemetry/sdk-metrics";
import { SpanExporter } from "@opentelemetry/sdk-trace-base";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { Instrumentation } from "@opentelemetry/instrumentation"
import { getNodeAutoInstrumentations, InstrumentationConfigMap } from "@opentelemetry/auto-instrumentations-node";

export interface RegisterOpenTelemetryParams {
    serviceName?: string;
    metricReader?: MetricReader;
    traceExporter?: SpanExporter;
    instrumentations?: Instrumentation[];
    autoInstrumentations?: InstrumentationConfigMap;
}

export function registerOpenTelemetry(params?: RegisterOpenTelemetryParams) {
    const otel = new NodeSDK({
        serviceName: params?.serviceName,
        metricReader: params?.metricReader,
        traceExporter: params?.traceExporter,
        instrumentations: [getNodeAutoInstrumentations(params?.autoInstrumentations), ...(params?.instrumentations ? params.instrumentations : [])],
    })

    otel.start();
}