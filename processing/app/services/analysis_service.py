import json

from datetime import datetime
from ollama import AsyncClient

from app.schemas.survey_points import FormAnalysis

class AnalysisService:
    ollama_client: AsyncClient
    model = "mistral:latest"

    def __init__(self, ollama_client: AsyncClient):
        self.ollama_client = ollama_client

    async def start_survey_analysis(self, survey_data: str ) -> FormAnalysis:
        prompt = self.construct_prompt("Form summary: Survey data analysis requested", survey_data)
        res = await self.ollama_client.chat(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            format=FormAnalysis.model_json_schema(),
        )

        return json.loads(res.message.content)

    def construct_prompt(self, survey_context: str, survey_data: str) -> str:
        prompt = f"""
            <input>
                Please analyze the form data and provide a detailed analysis of the results, in desired json structure.
                Dont fill fields if you don't know the answer, just leave it empty.
                today is {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}.
                model name is {self.model}.
                If you cannot answer about sentiment, just leave it empty.
                {survey_context}

                {survey_data}              
            </input>
        """

        return prompt
