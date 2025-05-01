from fastapi import FastAPI
from sqlmodel import Session, select

from app.database import create_db_and_tables, engine
from .models import AnalysisJob, Item


app = FastAPI()

@app.on_event("startup")
def on_startup():
    create_db_and_tables() # Create tables if they don't exist
    with Session(engine) as session:
            # Check if the item already exists to avoid duplicate inserts
            exists = session.exec(select(AnalysisJob).where(AnalysisJob.survey_id == "1")).first()
            if not exists:
                item = AnalysisJob(survey_id="1")
                session.add(item)
                session.commit()

@app.get("/")
def read_root():
    return {"message": "Hello, World!"}

@app.post("/items")
def create_item(item: Item):
    return {"item_received": item}

@app.get("/jobs", response_model=list[AnalysisJob])
def read_jobs():
    with Session(engine) as session:
        statement = select(AnalysisJob)
        results = session.exec(statement)
        return results.all()
