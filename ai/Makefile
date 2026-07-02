# ================================
# AI Interview Engine - Makefile
# ================================

.PHONY: help venv install run test lint format migrate revision downgrade \
        docker-up docker-down docker-logs docker-shell clean

# Default target
help:
	@echo "Available commands:"
	@echo ""
	@echo " Local Development:"
	@echo "  make venv          Create virtual environment"
	@echo "  make install       Install Python dependencies"
	@echo "  make run           Run Flask app locally"
	@echo "  make test          Run test suite"
	@echo ""
	@echo " Code Quality:"
	@echo "  make lint          Run flake8"
	@echo "  make format        Run black + isort"
	@echo ""
	@echo " Database (Alembic):"
	@echo "  make migrate       Apply migrations (upgrade head)"
	@echo "  make revision      Create new migration (autogenerate)"
	@echo "  make downgrade     Roll back last migration"
	@echo ""
	@echo " Docker:"
	@echo "  make docker-up     Build and start Docker stack"
	@echo "  make docker-down   Stop Docker stack"
	@echo "  make docker-logs   View container logs"
	@echo "  make docker-shell  Shell into API container"
	@echo ""
	@echo " Cleanup:"
	@echo "  make clean         Remove cache and temp files"
	@echo ""

# ----------------
# Local setup
# ----------------

venv:
	python -m venv venv

install:
	pip install --upgrade pip
	pip install -r requirements.txt

run:
	python -m app.main

test:
	pytest -v

# ----------------
# Code quality
# ----------------

lint:
	flake8 app

format:
	black app
	isort app

# ----------------
# Database (Alembic)
# ----------------

migrate:
	alembic -c migrations/alembic.ini upgrade head

revision:
	alembic -c migrations/alembic.ini revision --autogenerate -m "auto migration"

downgrade:
	alembic -c migrations/alembic.ini downgrade -1

# ----------------
# Docker
# ----------------

docker-up:
	docker compose up --build

docker-down:
	docker compose down

docker-logs:
	docker compose logs -f

docker-shell:
	docker compose exec api /bin/sh

# ----------------
# Cleanup
# ----------------

clean:
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete
	find . -type f -name "*.pyo" -delete
	find . -type f -name "*.log" -delete
