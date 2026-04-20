# python:3.11-slim (Debian Bookworm) ships glibc 2.36, which satisfies
# the manylinux_2_17 requirement of the rdkit PyPI binary wheel.
FROM python:3.11-slim

WORKDIR /app

# libxrender1 / libxext6 are required by RDKit's X11-linked internals even
# when only the pure-vector SVG renderer (MolDraw2DSVG) is used.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libxrender1 \
    libxext6 \
    libexpat1 \
    libcairo2 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Install runtime + dev (pytest) dependencies first for layer caching.
COPY apps/api/pyproject.toml ./
RUN pip install --no-cache-dir ".[dev]"

# Copy application source, migrations, and tests.
COPY apps/api/app/ ./app/
COPY apps/api/alembic/ ./alembic/
COPY apps/api/alembic.ini ./alembic.ini
COPY apps/api/tests/ ./tests/

# Copy startup script and make it executable.
COPY infra/scripts/start-api.sh ./start-api.sh
RUN chmod +x ./start-api.sh

RUN adduser --disabled-password --no-create-home --gecos "" appuser \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000
CMD ["/app/start-api.sh"]
