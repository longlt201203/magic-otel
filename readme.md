# Magic OpenTelemetry

A lightweight TypeScript library that simplifies OpenTelemetry integration for Node.js applications. Magic-OTEL provides easy-to-use decorators for method tracing and a custom Zipkin file exporter for local development and debugging.

## Features

- 🚀 Simple setup with minimal configuration
- 🔍 Method-level tracing with TypeScript decorators
- 📁 Custom Zipkin file exporter for local development
- 🔌 Auto-instrumentation for popular Node.js libraries
- 🛠️ Flexible configuration options

## Installation

```bash
npm install magic-otel
# or
yarn add magic-otel
```

Make sure to also install the required peer dependencies:

```bash
npm install @opentelemetry/api @opentelemetry/sdk-node
# or
yarn add @opentelemetry/api @opentelemetry/sdk-node
```

## Quick Start

### Basic Setup

```typescript
import { registerOpenTelemetry } from 'magic-otel';

// Initialize OpenTelemetry with default settings
registerOpenTelemetry({
  serviceName: 'my-service'
});

// Your application code here
```

### Method Tracing with Decorators

```typescript
import { Tracing } from 'magic-otel';

class UserService {
  @Tracing()
  async getUserById(id: string) {
    // This method will be automatically traced
    return { id, name: 'John Doe' };
  }
}
```

### Class-level Tracing

```typescript
import { ClassTracing } from 'magic-otel';

@ClassTracing()
class OrderService {
  // All methods in this class will be automatically traced
  async createOrder(data: any) {
    return { orderId: '123', status: 'created' };
  }
  
  async getOrderById(id: string) {
    return { id, items: [] };
  }
}
```

### Using the Zipkin File Exporter

```typescript
import { registerOpenTelemetry, ZipkinFileSpanExporter } from 'magic-otel';
import * as path from 'path';

// Create a Zipkin file exporter
const exporter = new ZipkinFileSpanExporter({
  exportDir: path.join(__dirname, 'traces'),
  serviceName: 'my-service',
  maxWrittenCount: 100 // Clean up after 100 exports
});

// Register OpenTelemetry with the exporter
registerOpenTelemetry({
  serviceName: 'my-service',
  traceExporter: exporter
});
```

## API Reference

### `registerOpenTelemetry(params?: RegisterOpenTelemetryParams)`

Initializes and starts the OpenTelemetry SDK with the provided configuration.

**Parameters:**

- `params.serviceName`: Name of your service
- `params.metricReader`: Custom metric reader
- `params.traceExporter`: Custom span exporter
- `params.instrumentations`: Additional instrumentations
- `params.autoInstrumentations`: Configuration for auto-instrumentations

### `ZipkinFileSpanExporter`

A custom span exporter that writes spans to JSON files in Zipkin format.

**Constructor options:**

- `exportDir`: Directory where span files will be saved
- `serviceName`: Name of your service (optional)
- `maxWrittenCount`: Maximum number of files before cleanup (optional, default: 100)

### Decorators

#### `@Tracing()`

A method decorator that automatically creates and manages spans for the decorated method.

#### `@ClassTracing()`

A class decorator that automatically applies tracing to all methods in the class.

## Examples

### Express Application with Tracing

```typescript
import express from 'express';
import { registerOpenTelemetry, Tracing } from 'magic-otel';

// Initialize OpenTelemetry
registerOpenTelemetry({
  serviceName: 'express-app'
});

class UserController {
  @Tracing()
  async getUsers(req: express.Request, res: express.Response) {
    // This method is traced
    const users = await fetchUsers();
    res.json(users);
  }
}

const userController = new UserController();
const app = express();

app.get('/users', (req, res) => userController.getUsers(req, res));

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```