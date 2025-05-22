import { trace } from "@opentelemetry/api";

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