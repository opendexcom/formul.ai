FROM python:3.13-slim

RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates

# Download the latest installer
ADD https://astral.sh/uv/install.sh /uv-installer.sh

# Run the installer then remove it
RUN sh /uv-installer.sh && rm /uv-installer.sh

# Ensure the installed binary is on the `PATH`
ENV PATH="/root/.local/bin/:$PATH"

# Add /app to PYTHONPATH
ENV PYTHONPATH="/app"

# Set workdir
WORKDIR /app

# Copy pyproject.toml first to leverage Docker cache
COPY pyproject.toml /app/
COPY alembic.ini /app/
COPY entrypoint.sh /app/

# Install dependencies
RUN uv sync

# Copy the rest of the application
ADD /alembic /app/alembic
ADD /app /app/app

# RUN uv run alembic upgrade heads

# Start app with Uvicorn
CMD ./entrypoint.sh
