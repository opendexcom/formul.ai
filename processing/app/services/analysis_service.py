from app.schemas.analyze_survey_data import AnalyzeSurveyData
from app.schemas.survey_points import SurveyPoints
from ollama import AsyncClient


class AnalysisService:
    ollama_client: AsyncClient

    def __init__(self, ollama_client: AsyncClient):
        self.ollama_client = ollama_client

    async def start_survey_analysis(self, survey_data: AnalyzeSurveyData):
        prompt = self.construct_prompt(survey_data)
        # print(prompt)
        # sys.stdout.flush()
        res = await self.ollama_client.chat(
            model="mistral:latest",
            messages=[{"role": "user", "content": prompt}],
            format=SurveyPoints.model_json_schema(),
        )

        return res.message.content or ""

    def construct_prompt(self, request: AnalyzeSurveyData) -> str:
        answer_tags = [f"<answer>{answer}</answer>" for answer in request.answers]
        answers_xml = "\n".join(answer_tags)

        prompt = f"""
            <input>
                You will be provided with survey question in `question` tag and responses in `answers` tag, one user answer per `answer` tag.
            </input>

            <question>
                {request.question}
            </question>

            <instruction>
                Rewiew and analize responses from `answers` with goal in mind to find and extract informations that will be relevant for question. Treat similar points like one. Group points into main buckets: \"frequent\", \"moderate\", \"occasional\" depending how often it was mentioned. Each bucket should group points into \"positive" and "negative" points.
            </instruction>

            <answers>
                {answers_xml}
            </answers>
        """

        return prompt
