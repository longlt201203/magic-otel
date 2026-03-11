import { SpanStatusCode, trace } from "@opentelemetry/api";

export function ClassTracing(): ClassDecorator {
    return (target) => {
        const className = target.name;
        const tracer = trace.getTracer(className);
        const propertyKeys = [
            ...Object.getOwnPropertyNames(target.prototype),
            ...Object.getOwnPropertySymbols(target.prototype),
        ];

        propertyKeys.forEach((propertyKey) => {
            if (propertyKey === "constructor") {
                return;
            }

            const descriptor = Object.getOwnPropertyDescriptor(target.prototype, propertyKey);
            if (descriptor && typeof descriptor.value === 'function') {
                const originalMethod = descriptor.value;
                const methodName = String(propertyKey);
                descriptor.value = function (...args: any[]) {
                    return tracer.startActiveSpan(`${className}.${methodName}`, (span) => {
                        try {
                            const result = originalMethod.apply(this, args);
                            if (result && typeof result.then === "function") {
                                return result
                                    .then((res: unknown) => {
                                        span.end();
                                        return res;
                                    })
                                    .catch((err: unknown) => {
                                        span.recordException(err as Error);
                                        span.setStatus({ code: SpanStatusCode.ERROR });
                                        span.end();
                                        throw err;
                                    });
                            }

                            span.end();
                            return result;
                        } catch (err: unknown) {
                            span.recordException(err as Error);
                            span.setStatus({ code: SpanStatusCode.ERROR });
                            span.end();
                            throw err;
                        }
                    });
                }
                Object.defineProperty(target.prototype, propertyKey, descriptor);
            }
        });
    }
}