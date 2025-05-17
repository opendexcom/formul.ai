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

# Install dependencies
RUN uv sync --no-dev

# Copy the rest of the application
ADD /app /app/app

RUN curl -o wait-for-it.sh https://raw.githubusercontent.com/vishnubob/wait-for-it/master/wait-for-it.sh
RUN chmod +x wait-for-it.sh

# Start app with Uvicorn
CMD ["/app/wait-for-it.sh", "${POSTGRES_HOST}:${POSTGRES_PORT}", "--", "/app/.venv/bin/uvicorn", "app.main:app", "--reload", "--host", "0.0.0.0", "--port", "8000"]
