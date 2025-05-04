from contextlib import asynccontextmanager
from uuid import UUID

from app.api.main import api_router
from app.database import create_db_and_tables
from app.database import reset_db
from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi
from pydantic import UUID4
from sqlmodel import Session

from . import deps
from .models import AnalysisTask
from .models import PSurvey
from .models import PSurveyAnswer


@asynccontextmanager
async def lifespan(app: FastAPI):
    engine = deps.get_database_engine()
    reset_db(engine)
    create_db_and_tables(engine)

    with Session(engine) as session:
        survey_id: UUID4 = UUID("6cb2588c-a93b-41fe-a4a3-9b08280f4e97")
        survey_exists = session.get(PSurvey, survey_id)
        if not survey_exists:
            survey = PSurvey(
                id=survey_id,
                name="example",
                schemaJson="{'question':'This is question'}",
            )
            session.add(survey)
            session.commit()
        else:
            print(f"Survey with ID {survey_id} already exists.")

        task = AnalysisTask(
            id=UUID("610c3050-0d86-4f6f-b7a6-759a42732f17"), survey_id=survey_id
        )
        task_exists = session.get(AnalysisTask, task.id)
        if not task_exists:
            session.add(task)
            session.commit()
        else:
            print(f"Task with ID {task.id} already exists.")

        for answer_text in ["Hiii", "Hiii2", "Hiii3"]:
            answer = PSurveyAnswer(survey_id=survey_id, answersJson=answer_text)
            answer_exists = session.get(PSurveyAnswer, answer.id)
            if not answer_exists:
                session.add(answer)
                session.commit()
            else:
                print(f"Answer with ID {answer.id} already exists.")

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
