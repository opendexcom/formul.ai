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
# Prevent __pycache__ folders from generating
ENV PYTHONDONTWRITEBYTECODE=1

# Set workdir
WORKDIR /app

# Copy pyproject.toml first to leverage Docker cache
COPY pyproject.toml alembic.ini entrypoint.sh /app/

# Install dependencies
# Reason why --no-dev is not used is because alembic migrations 
# require dev dependencies and as of now are executed as part of entrypoint
RUN uv sync

# Copy migrations: ideally these would be only in the builder step
ADD /alembic /app/alembic
# Copy the rest of the application
ADD /app /app/app

# Start app with Uvicorn
CMD ./entrypoint.sh
