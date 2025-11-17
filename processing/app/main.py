from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi

from app import fixtures
from app.api.router import api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await fixtures.load_initial_data()

    yield  # Startup complete

    # Optional: Add shutdown logic here if needed
    print("Shutting down...")


app = FastAPI(lifespan=lifespan)

app.include_router(api_router)


def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    openapi_schema = get_openapi(
        title="Processing API",
        version="1.0.0",
        description="This is a processing API for survey analysis.",
        routes=app.routes,
    )
    openapi_schema["servers"] = [{"url": "http://localhost/api/processing"}]

    app.openapi_schema = openapi_schema
    return app.openapi_schema


app.openapi = custom_openapi
