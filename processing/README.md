## Configure locally

### Configure `venv`

#### Create

```bash
python3 -m venv venv
```

#### Activate

Linux

`source venv/bin/activate`

On Windows (cmd.exe):

```bash
venv\Scripts\activate
```

On Windows (PowerShell):

```
.\venv\Scripts\Activate.ps1
```

### Install dependencies

```bash
pip install -r requirements.txt
```

### Run

Run in development mode with auto-reloading

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

## Run with docker compose with ollama profile

Run (append `-d` for deattached mode)

```bash
docker compose --profile ollama up
```

When encountering error `could not select device driver “” with capabilities: [[gpu]]` see [this answer](https://forums.developer.nvidia.com/t/could-not-select-device-driver-with-capabilities-gpu/80200/2)

## Installing LLM model on ollama container

1. Start `docker compose` in deattach mode
2. Run command line inside ai container

```bash
docker compose exec -it ai bash
```

3. Install desired model (in this example its mistral:latest)

```bash
ollama pull mistral:latest
```

## Run tests

All tests are placed in `app/tests` folder.

This will run all tests

```bash
pytest
```
