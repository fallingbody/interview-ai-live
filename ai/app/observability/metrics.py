import time
from flask import Flask, request, Response
from prometheus_client import (
    Counter,
    Histogram,
    generate_latest,
    CONTENT_TYPE_LATEST,
)

from app.core.logger import get_logger

logger = get_logger(__name__)

REQUEST_COUNT = Counter(
    "http_requests_total",
    "Total HTTP requests",
    ["method", "endpoint", "status"],
)

REQUEST_LATENCY = Histogram(
    "http_request_latency_seconds",
    "HTTP request latency",
    ["endpoint"],
)


def init_metrics(app: Flask) -> None:
    @app.before_request
    def start_timer():
        # Store start time explicitly (safe for Flask)
        request._start_time = time.perf_counter()

    @app.after_request
    def record_metrics(response):
        # Increment request counter
        REQUEST_COUNT.labels(
            method=request.method,
            endpoint=request.path,
            status=response.status_code,
        ).inc()

        # Record latency safely
        start_time = getattr(request, "_start_time", None)
        if start_time is not None:
            duration = time.perf_counter() - start_time
            REQUEST_LATENCY.labels(
                endpoint=request.path
            ).observe(duration)

        return response

    @app.route("/metrics")
    def metrics():
        return Response(
            generate_latest(),
            mimetype=CONTENT_TYPE_LATEST,
        )

    logger.info("Prometheus metrics initialized")
