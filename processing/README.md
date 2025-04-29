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

## Start with docker

### Build Image

This will create image called `processing`

```bash
docker build -t processing .
```

### Create Container

This will create and start container called `processing_container` from image `processing` on port `8000`.
If container with this name exist - if will fail, then see [starting existing container](#start-existing-container)

```bash
docker run --name processing_container -p 8000:8000 processing
```

### Start Existing Container

```bash
docker start processing_container
```
