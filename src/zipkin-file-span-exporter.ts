import { SpanKind, SpanStatusCode } from "@opentelemetry/api";
import {
	ExportResult,
	ExportResultCode,
	hrTimeToMicroseconds,
} from "@opentelemetry/core";
import {
	ReadableSpan,
	SpanExporter,
	TimedEvent,
} from "@opentelemetry/sdk-trace-node";
import * as fs from "fs";
import * as path from "path";

enum ZipKindSpanType {
	CLIENT = "CLIENT",
	SERVER = "SERVER",
	CONSUMER = "CONSUMER",
	PRODUCER = "PRODUCER",
}

const ZIPKIN_SPAN_KIND_MAPPING = {
	[SpanKind.CLIENT]: ZipKindSpanType.CLIENT,
	[SpanKind.SERVER]: ZipKindSpanType.SERVER,
	[SpanKind.CONSUMER]: ZipKindSpanType.CONSUMER,
	[SpanKind.PRODUCER]: ZipKindSpanType.PRODUCER,
	[SpanKind.INTERNAL]: undefined,
};

export interface ZipkinFileSpanExporterOptions {
	exportDir: string;
	serviceName?: string;
	maxWrittenCount?: number;
}

export class ZipkinFileSpanExporter implements SpanExporter {
	private serviceName: string = "zipkin-file-exporter";
	private statusCodeTagName: string = "otel.status_code";
	private statusErrorTagName: string = "error";
	private spanFolder: string = "spans";
	private writtenCount: number = 0;
	private maxWrittenCount: number = 100;

	constructor(options: ZipkinFileSpanExporterOptions) {
		this.serviceName = options.serviceName || this.serviceName;
		this.spanFolder = options.exportDir || this.spanFolder;
		this.maxWrittenCount = options.maxWrittenCount || this.maxWrittenCount;
		// Init spans folder
		if (!fs.existsSync(this.spanFolder)) {
			fs.mkdirSync(this.spanFolder);
		}
	}

	toZipkinTags({
		attributes,
		resource,
		status,
		droppedAttributesCount,
		droppedEventsCount,
		droppedLinksCount,
	}: ReadableSpan) {
		const tags: { [key: string]: string } = {};
		for (const key of Object.keys(attributes)) {
			tags[key] = String(attributes[key]);
		}
		if (status.code !== SpanStatusCode.UNSET) {
			tags[this.statusCodeTagName] = String(SpanStatusCode[status.code]);
		}
		if (status.code === SpanStatusCode.ERROR && status.message) {
			tags[this.statusErrorTagName] = status.message;
		}
		/* Add droppedAttributesCount as a tag */
		if (droppedAttributesCount) {
			tags["otel.dropped_attributes_count"] = String(droppedAttributesCount);
		}

		/* Add droppedEventsCount as a tag */
		if (droppedEventsCount) {
			tags["otel.dropped_events_count"] = String(droppedEventsCount);
		}

		/* Add droppedLinksCount as a tag */
		if (droppedLinksCount) {
			tags["otel.dropped_links_count"] = String(droppedLinksCount);
		}

		Object.keys(resource.attributes).forEach(
			(name) => (tags[name] = String(resource.attributes[name])),
		);

		return tags;
	}

	private toZipkinSpan(span: ReadableSpan) {
		const data = {
			traceId: span.spanContext().traceId,
			parentId: span.parentSpanContext?.spanId,
			name: span.name,
			id: span.spanContext().spanId,
			kind: ZIPKIN_SPAN_KIND_MAPPING[span.kind],
			timestamp: hrTimeToMicroseconds(span.startTime),
			duration: Math.round(hrTimeToMicroseconds(span.duration)),
			localEndpoint: { serviceName: this.serviceName },
			tags: this.toZipkinTags(span),
			annotations: span.events.length
				? this.toZipkinAnnotations(span.events)
				: undefined,
		};
		return data;
	}

	private toZipkinAnnotations(events: TimedEvent[]) {
		return events.map((event) => ({
			timestamp: Math.round(hrTimeToMicroseconds(event.time)),
			value: event.name,
		}));
	}

	private cleanupSpansFolder() {
		fs.readdir(this.spanFolder, (err, files) => {
			if (err) {
				console.error("Error reading spans folder:", err);
				return;
			}
			files.forEach((file) => {
				const filePath = path.join(this.spanFolder, file);
				fs.unlink(filePath, (err) => {
					if (err) {
						console.error("Error deleting file:", err);
					} else {
						console.log("File deleted successfully:", filePath);
					}
				});
			});
		});
	}

	export(
		spans: ReadableSpan[],
		resultCallback: (result: ExportResult) => void,
	): void {
		const filePath = path.join(
			this.spanFolder,
			`${Date.now()}.json`,
		);
		const jsonSpans = spans.map((span) => this.toZipkinSpan(span));

		// Write to file
		fs.writeFile(filePath, JSON.stringify(jsonSpans, null, 2), (err: any) => {
			if (err) {
				console.error("Error writing spans to file:", err);
				resultCallback({ code: ExportResultCode.FAILED });
			} else {
				console.log("Spans written to file successfully.");
				resultCallback({ code: ExportResultCode.SUCCESS });
			}
		});
		this.writtenCount++;
		if (this.writtenCount >= this.maxWrittenCount) {
			this.cleanupSpansFolder();
			this.writtenCount = 0;
		}
	}

	async shutdown() {
		console.log("Shutting down FileSpanExporter");
	}
}
