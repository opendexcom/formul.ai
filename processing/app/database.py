from sqlmodel import SQLModel, create_engine

postgres_user="user"
postgres_password="password"
postgres_host="db"
postgres_db="survey_db"
postgres_port="5432"

postgres_url = f"postgresql+psycopg://{postgres_user}:{postgres_password}@{postgres_host}:{postgres_port}/{postgres_db}"

engine = create_engine(postgres_url, echo=True, future=True)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

def reset_db():
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)
