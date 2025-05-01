from ollama import AsyncClient

def get_ollama_client() -> AsyncClient:
   return AsyncClient(host="http://ai:11434")
