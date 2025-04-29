from fastapi import FastAPI
from .models import Item

app = FastAPI()

@app.get("/")
def read_root():
    return {"message": "Hello, World!"}

@app.post("/items/")
def create_item(item: Item):
    return {"item_received": item}
