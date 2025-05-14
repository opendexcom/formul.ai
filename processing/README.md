# Project Setup and Usage Guide

## About the Project

This project serves as an interface to the "llm" service (`ai`). The primary purpose of the `ai` service is to prepare proper AI queries to analyze survey data. The analyzed results are then stored in the database. Surveys are also retrieved from the database for processing.

### Database Usage

The project uses a database to:
- Retrieve survey data for analysis.
- Store the results of the AI analysis.

Ensure the database is properly configured and running before starting the application. The database connection details can be found in the project's configuration files.

---

## Configure Locally

### 1. Set Up Environment with `uv`

#### Install `uv`

Follow the installation instructions for `uv` from the [official documentation](https://docs.astral.sh/uv/getting-started/installation/).

#### Sync Environment

Run the following command to sync the environment:

```bash
uv sync
```

### 2. Run the Application

Run the application in development mode with auto-reloading:

```bash
uv run
```

---

## Run with Docker Compose (Ollama Profile)

### Start Services

Run the following command to start services (append `-d` for detached mode):

```bash
docker compose --profile ollama up
```

### Notes

- `docker compose up` will run every service except `ai`.
- `docker compose --profile "*"` will run all possible services.
- `docker compose --profile ollama` will start the `ollama` profile.

For more information, see the [Docker Compose profiles documentation](https://docs.docker.com/compose/how-tos/profiles/).

### Troubleshooting

If you encounter the error `could not select device driver “” with capabilities: [[gpu]]`, refer to [this answer](https://forums.developer.nvidia.com/t/could-not-select-device-driver-with-capabilities-gpu/80200/2).

---

## Installing LLM Model on Ollama Container

1. Start Docker Compose in detached mode:

   ```bash
   docker compose up -d
   ```

2. Access the `ai` container:

   ```bash
   docker compose exec -it ai bash
   ```

3. Install the desired model (e.g., `mistral:latest`):

   ```bash
   ollama pull mistral:latest
   ```

---

## Run Tests

All tests are located in the `app/tests` folder.

Run all tests using `uv`:

```bash
uv test
```

---

## Continuous Integration (CI)

This project uses GitHub Actions for continuous integration.  
On every pull request that changes files in the `processing/` folder, the following checks are automatically run:

- **Dependency Sync:** Ensures all dependencies are installed using `uv`.
- **Linting:** Runs [ruff](https://docs.astral.sh/ruff/) to check code style and quality.
- **Testing:** Runs all tests using `uv test`.
- **Coverage:** (If configured) Ensures test coverage meets the required threshold.

You can find the workflow configuration in `.github/workflows/processing.tests.yml`.
