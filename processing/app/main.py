
import contextvars

from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi

print(contextvars)
from app.api.router import api_router

app = FastAPI()

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
