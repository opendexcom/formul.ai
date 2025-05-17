from contextlib import asynccontextmanager
from uuid import UUID

from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi
from pydantic import UUID4

from app.api.router import api_router
from app.db.database import create_db_and_tables, reset_db

from .api import deps
from .models.survey import Survey
from .models.survey_answer import SurveyAnswer
from .models.task import Task


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = deps.get_settings()
    engine = deps.get_db_engine(settings=settings)
    await reset_db(engine)
    await create_db_and_tables(engine)
    session_factory = deps.get_db_session_factory(engine=engine)

    async with session_factory() as session:
        survey_id: UUID4 = UUID("6cb2588c-a93b-41fe-a4a3-9b08280f4e97")
        survey_exists = await session.get(Survey, survey_id)
        if not survey_exists:
            survey = Survey(
                id=survey_id,
                name="example",
                json_schema="{'question':'This is question'}",
            )
            session.add(survey)
            await session.commit()
        else:
            print(f"Survey with ID {survey_id} already exists.")

        task = Task(id=UUID("610c3050-0d86-4f6f-b7a6-759a42732f17"), survey_id=survey_id)
        task_exists = await session.get(Task, task.id)
        if not task_exists:
            session.add(task)
            await session.commit()
            print(f"Task with ID {task.id} created.")
        else:
            print(f"Task with ID {task.id} already exists.")

        for answer_text in [
            "I like that we’re using real-world tools like Docker and microservices — good exposure. But honestly, coordination’s been messy. We need clearer ownership per service.",
            "It’s cool we’re blending multiple languages and tools, but context-switching between Java and Python is painful. Feels like overkill for a student project.",
            "I love how ambitious the project is, especially using AI for survey analysis — feels meaningful. But the team’s all over the place skill-wise, which slows things down.",
            "I like that we’re using GitHub seriously — issues, branches, pull requests. But half the team still doesn’t really know Git, which makes merges frustrating.",
            "React frontend looks solid so far, props to whoever’s owning that. But we still haven’t nailed down our API contracts, and it’s breaking stuff constantly.",
            "Cool idea and stack, but we probably should’ve picked one backend language. Java + Python + microservices = too many moving parts for a mostly newbie team.",
            "Docker is a great learning experience — finally feels like we’re building something 'real.' Downside is debugging containers eats way too much time.",
            "I like that we’re treating it like a real product — planning, meetings, reviews. But I wish we spent less time in meetings and more actually coding.",
            "Feels good seeing everyone improve. Some people came in barely knowing Git, now they’re doing pull requests. But onboarding new members is still painful.",
            "I’m proud we’re pulling off microservices, even in a rough way. Just wish we spent more time upfront defining how they’d talk to each other.",
            "Survey AI analysis is a solid use case. But labeling training data manually? Ugh. We need a better workflow for that.",
            "Really like how we split work — frontend/backend/devops. But we’re lacking real integration testing, so services often don’t play nice.",
            "Fun project, even if chaotic. Everyone’s learning fast. But we need more code reviews — too many bugs sneak in.",
            "Honestly, I’m surprised how far we’ve come given how many of us started clueless. But I’d kill for a better README and setup guide.",
            "Cool tech stack, solid project idea, and I like the energy. But right now, too much tech for too little process — we need to simplify or organize better.",
        ]:
            answer = SurveyAnswer(survey_id=survey_id, answers_json=answer_text)
            answer_exists = await session.get(SurveyAnswer, answer.id)
            if not answer_exists:
                session.add(answer)
                await session.commit()
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
