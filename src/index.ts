import { MetricReader } from "@opentelemetry/sdk-metrics";
import { SpanExporter } from "@opentelemetry/sdk-trace-base";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { Instrumentation } from "@opentelemetry/instrumentation"
import { getNodeAutoInstrumentations, InstrumentationConfigMap } from "@opentelemetry/auto-instrumentations-node";
import { trace } from "@opentelemetry/api";

export interface RegisterOpentelemetryParams {
    serviceName?: string;
    metricReader?: MetricReader;
    traceExporter?: SpanExporter;
    instrumentations?: Instrumentation[];
    autoInstrumentations?: InstrumentationConfigMap;
}

export function registerOpentelemetry(params?: RegisterOpentelemetryParams) {
    const otel = new NodeSDK({
        serviceName: params?.serviceName,
        metricReader: params?.metricReader,
        traceExporter: params?.traceExporter,
        instrumentations: [getNodeAutoInstrumentations(params?.autoInstrumentations), ...(params?.instrumentations ? params.instrumentations : [])],
    })

    otel.start();
}

export function Tracing(): MethodDecorator {
    return (target, propertyKey, descriptor: PropertyDescriptor) => {
        const className = target.constructor.name;
        const tracer = trace.getTracer(className);
        const originalMethod = descriptor.value;
        descriptor.value = function (...args: any[]) {
            const span = tracer.startSpan(`${className}.${propertyKey.toString()}`);
            try {
                const result = originalMethod.apply(this, args);
                if (result instanceof Promise) {
                    return result
                        .then((res) => {
                            span.end();
                            return res;
                        })
                        .catch((err) => {
                            span.recordException(err);
                            span.end();
                            throw err;
                        });
                } else {
                    span.end();
                    return result;
                }
            } catch (err: any) {
                span.recordException(err);
                span.end();
                throw err;
            }
        }
    }
}

export function ClassTracing(): ClassDecorator {
    return (target) => {
        const className = target.name;
        const tracer = trace.getTracer(className);
        Object.getOwnPropertyNames(target.prototype).forEach((propertyKey) => {
            const descriptor = Object.getOwnPropertyDescriptor(target.prototype, propertyKey);
            if (descriptor && typeof descriptor.value === 'function') {
                const originalMethod = descriptor.value;
                descriptor.value = function (...args: any[]) {
                    const span = tracer.startSpan(`${className}.${propertyKey}`);
                    try {
                        const result = originalMethod.apply(this, args);
                        if (result instanceof Promise) {
                            return result
                                .then((res) => {
                                    span.end();
                                    return res;
                                })
                                .catch((err) => {
                                    span.recordException(err);
                                    span.end();
                                    throw err;
                                });
                        } else {
                            span.end();
                            return result;
                        }
                    } catch (err: any) {
                        span.recordException(err);
                        span.end();
                        throw err;
                    }
                }
                Object.defineProperty(target.prototype, propertyKey, descriptor);
            }
        });
    }
}