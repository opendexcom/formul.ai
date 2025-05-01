from uuid import UUID
from fastapi import Depends, FastAPI
import sqlalchemy.exc
from sqlmodel import Session, select

from app.database import create_db_and_tables

from . import deps

from .models import AnalysisJob, Item

app = FastAPI()

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

@app.get("/jobs", response_model=list[AnalysisJob])
def read_jobs(engine = Depends(deps.get_database_engine)):
    with Session(engine) as session:
        statement = select(AnalysisJob)
        results = session.exec(statement)
        return results.all()
