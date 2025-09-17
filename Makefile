.PHONY: help venv install install-dev lint format test clean run

help:
	@echo "Available commands:"
	@echo "  venv         Create virtual environment"
	@echo "  install      Install production dependencies"
	@echo "  install-dev  Install development dependencies"
	@echo "  lint         Run all linting tools"
	@echo "  format       Format code with black and isort"
	@echo "  test         Run tests with pytest"
	@echo "  clean        Clean up cache files"
	@echo "  run          Run the FastAPI server"

venv:
	python3 -m venv venv
	@echo "Virtual environment created. Activate with: source venv/bin/activate"

install:
	@if [ ! -d "venv" ]; then echo "Virtual environment not found. Run 'make venv' first."; exit 1; fi
	./venv/bin/pip install -r preppal/backend/requirements.txt

install-dev:
	@if [ ! -d "venv" ]; then echo "Virtual environment not found. Run 'make venv' first."; exit 1; fi
	./venv/bin/pip install -r preppal/backend/requirements.txt
	./venv/bin/pip install -r preppal/backend/requirements-dev.txt

lint:
	@if [ ! -d "venv" ]; then echo "Virtual environment not found. Run 'make venv' and 'make install-dev' first."; exit 1; fi
	./venv/bin/flake8 preppal/backend/
	./venv/bin/mypy preppal/backend/
	./venv/bin/bandit -r preppal/backend/

format:
	@if [ ! -d "venv" ]; then echo "Virtual environment not found. Run 'make venv' and 'make install-dev' first."; exit 1; fi
	./venv/bin/black preppal/backend/
	./venv/bin/isort preppal/backend/

test:
	@if [ ! -d "venv" ]; then echo "Virtual environment not found. Run 'make venv' and 'make install-dev' first."; exit 1; fi
	./venv/bin/pytest preppal/backend/tests/ --cov=preppal/backend --cov-report=html

clean:
	find . -type f -name "*.pyc" -delete
	find . -type d -name "__pycache__" -delete
	find . -type d -name "*.egg-info" -exec rm -rf {} +
	rm -rf .coverage htmlcov/ .pytest_cache/ .mypy_cache/

run:
	@if [ ! -d "venv" ]; then echo "Virtual environment not found. Run 'make venv' and 'make install-dev' first."; exit 1; fi
	cd preppal/backend && ../../venv/bin/uvicorn main:app --reload --host 0.0.0.0 --port 8000
