from uuid import UUID
from fastapi import Depends, FastAPI
from sqlmodel import Session, select

from app.database import create_db_and_tables

from . import deps

from .models import AnalysisJob, Item

app = FastAPI()

@app.on_event("startup")
def on_startup():
    engine = deps.get_database_engine()
    create_db_and_tables(engine)
    try:
        with Session(engine) as session:
            fixed_bytes = b'\x12\x34\x56\x78\x90\xab\xcd\xef\xfe\xdc\xba\x09\x87\x65\x43\x21'
            fixed_uuid = UUID(bytes=fixed_bytes)
            item = AnalysisJob(id=fixed_uuid, survey_id="1")
            session.add(item)
            session.commit()
    except Exception as e:
        pass

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
