
import asyncio
import json
import app.services.analysis_service as analysis_service


from app.schemas.survey_points import FormAnalysis
from ollama import AsyncClient


async def main():
    ollama_client = AsyncClient()
    analysis_service_instance = analysis_service.AnalysisService(ollama_client=ollama_client)
    result = await analysis_service_instance.start_survey_analysis("""Form summary:
- uuid-f1: Top answers — TypeScript (55), Python (35), Java (20)
- uuid-f2: Average experience — 3.8 years, range 0–15
- uuid-f3: React selected by 90 respondents, Vue 30, Svelte 15, Angular 10
- uuid-f4: Common themes — full-stack, cloud, architecture
""")
    print("Analysis result (raw):")
    print(result)

if __name__ == "__main__":
    asyncio.run(main())
