from fastapi import FastAPI
from .models import Item, ProcessSurveyRequest

from ollama import AsyncClient

client = AsyncClient(
  # TODO: use env var for connection url
  host='http://ai:11434',
)

app = FastAPI()

@app.get("/")
def read_root():
    return {"message": "Hello, World!"}

@app.post("/items/")
def create_item(item: Item):
    return {"item_received": item}


def construct_propmpt(request:ProcessSurveyRequest) -> str:
    prompt = "<input>\n"
    prompt += f"You will be provided with survey responses in `answers` tag, one user answer is in `answer` tag. Question for survey: {request.question}\n"
    prompt += "</input>\n"
    prompt += "\n"
    prompt += "<instruction>\n"
    prompt += "Rewiew and analize responses from `answers` with goal in mind to find and extract informations that will be relevant for question. Treat similar points like one. Prefix each point accounted in final response with: \"frequent\", \"moderate\", \"occasional\" depending how often it was mentioned.\n"
    prompt += "</instruction>\n"
    prompt += "\n"
    prompt += "<answers>\n"
    for answer in request.answers:
        prompt += f"<answer>{answer}</answer>\n"
    prompt += "</answers>"
    return prompt


async def ask_ollama_process(request: ProcessSurveyRequest):

    prompt = construct_propmpt(request)

    res=await client.chat(
        model="mistral:latest",
        messages=[
            {
                'role': 'user',
                'content': prompt
            }
        ],
    )

    return res.message.content

# test with curl -X POST http://localhost/api/processing/ask -H "Content-Type: application/json"   -d '{"survey_id": "123", "answers": ["I love the product", "The product is great", "I would recommend it to others"]}'

@app.post("/ask")
async def ask_ollama(request: ProcessSurveyRequest):

    res=await ask_ollama_process(request)

    return {"llm_response": res}
