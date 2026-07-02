from flask import Flask, request
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import (
    OTLPSpanExporter,
)

from app.core.config import settings
from app.core.logger import get_logger

logger = get_logger(__name__)


def init_tracing(app: Flask) -> None:
    """
    Initialize OpenTelemetry tracing.
    """
    if settings.ENV == "development":
        logger.info("Tracing disabled in development")
        return

    resource = Resource.create(
        {
            "service.name": settings.APP_NAME,
            "deployment.environment": settings.ENV,
        }
    )

    provider = TracerProvider(resource=resource)
    trace.set_tracer_provider(provider)

    exporter = OTLPSpanExporter()
    span_processor = BatchSpanProcessor(exporter)

    provider.add_span_processor(span_processor)

    tracer = trace.get_tracer(__name__)

    @app.before_request
    def start_request_span():
        span = tracer.start_span(
            name=f"{request.method} {request.path}"
        )
        request._otel_span = span

    @app.after_request
    def end_request_span(response):
        span = getattr(request, "_otel_span", None)
        if span:
            span.set_attribute("http.status_code", response.status_code)
            span.end()
        return response

    logger.info("OpenTelemetry tracing initialized")
