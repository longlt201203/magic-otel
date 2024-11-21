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
        const tracer = trace.getTracer(`${className}.${propertyKey.toString()}`);
        const originalMethod = descriptor.value;
        descriptor.value = function (...args: any[]) {
            const span = tracer.startSpan(propertyKey.toString());
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
        Object.getOwnPropertyNames(target.prototype).forEach((propertyKey) => {
            const descriptor = Object.getOwnPropertyDescriptor(target.prototype, propertyKey);
            if (descriptor && typeof descriptor.value === 'function') {
                const tracer = trace.getTracer(`${className}.${propertyKey}`);
                const originalMethod = descriptor.value;
                descriptor.value = function (...args: any[]) {
                    const span = tracer.startSpan(propertyKey);
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