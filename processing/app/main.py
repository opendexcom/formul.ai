from uuid import UUID
from fastapi import Depends, FastAPI
from fastapi.openapi.utils import get_openapi
import sqlalchemy.exc
from sqlmodel import Session, select

from ollama import AsyncClient

from app.database import create_db_and_tables
from . import deps
from .models import AnalysisJob, Item, ProcessSurveyRequest, ProcessSurveyResponse

app = FastAPI()

def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    openapi_schema = get_openapi(
        title="Processing API",
        version="1.0.0",
        description="This is a processing API for survey analysis.",
        routes=app.routes,
    )
    openapi_schema["servers"] = [
        {"url": "http://localhost/api/processing"}
    ]

    app.openapi_schema = openapi_schema
    return app.openapi_schema

app.openapi = custom_openapi

@app.on_event("startup")
def on_startup():
    engine = deps.get_database_engine()
    create_db_and_tables(engine)
    with Session(engine) as session:
            item=AnalysisJob(id=UUID('12345678-90ab-cdef-fedc-ba0987654321'), survey_id="1")
            session.add(item)
            try:
                session.commit()
            except sqlalchemy.exc.IntegrityError as e:
                # This error occurs if the job already exists, and it's ok, since we have fixed ID
                # we won't check for existence of this job beforehand because we are not in a transaction
                # and cannot guarantee that the job will not be created between the check and the insert
                print(f"Failed to create a job at startup: {e}")

@app.get("/")
def read_root():
    return {"message": "Hello, World!"}

@app.post("/items")
def create_item(item: Item):
    return {"item_received": item}

@app.post("/{id}/start")
def start_job(id: UUID, engine = Depends(deps.get_database_engine)):
    return {"message": "Job started: " + str(id)}

@app.get("/jobs", response_model=list[AnalysisJob])
def read_jobs(engine = Depends(deps.get_database_engine)):
    with Session(engine) as session:
        statement = select(AnalysisJob)
        results = session.exec(statement)
        return results.all()

def construct_prompt(request:ProcessSurveyRequest) -> str:
    answer_tags = [f"<answer>{answer}</answer>" for answer in request.answers]
    answers_xml = "\n".join(answer_tags)

    prompt = f"""
        <input>
            You will be provided with survey responses in `answers` tag, one user answer is in `answer` tag. Question for survey: {request.question}
        </input>

        <instruction>
            Rewiew and analize responses from `answers` with goal in mind to find and extract informations that will be relevant for question. Treat similar points like one. Prefix each point accounted in final response with: \"frequent\", \"moderate\", \"occasional\" depending how often it was mentioned.
        </instruction>

        <answers>
            {answers_xml}
        </answers>
    """

    return prompt

async def ask_ollama_process(request: ProcessSurveyRequest,client: AsyncClient) -> str:

    prompt = construct_prompt(request)

    res=await client.chat(
        model="mistral:latest",
        messages=[
            {
                'role': 'user',
                'content': prompt
            }
        ],
    )

    return res.message.content or ""

@app.post("/ask", response_model=ProcessSurveyResponse)
async def ask_ollama(request: ProcessSurveyRequest, client: AsyncClient = Depends(deps.get_ollama_client)):

    res=await ask_ollama_process(request,client)

    return {"llm_response": res}
