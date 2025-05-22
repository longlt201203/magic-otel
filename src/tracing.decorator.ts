import { trace } from "@opentelemetry/api";

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