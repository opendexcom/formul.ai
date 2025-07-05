import json
import logging
import traceback
from datetime import datetime
from typing import Any, Dict, List, Optional

import mcp.types

# Set the protocol version before using ClientSession
mcp.types.LATEST_PROTOCOL_VERSION = "2024-11-05"

from mcp import ClientSession
from mcp.client.sse import sse_client
from ollama import AsyncClient

from app.schemas.survey_points import FormAnalysis, Analysis, OverallSummary, NumericalSummary, SentimentDistribution
from app.utils.redis_publisher import publish_survey_status, SurveyStatus

# Configure logger for debug messages
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)


class AnalysisService:
    ollama_client: AsyncClient
    model = "mistral:latest"
    mcp_server_url: str

    def __init__(self, ollama_client: AsyncClient, mcp_server_url: str):
        self.ollama_client = ollama_client
        self.mcp_server_url = mcp_server_url
        print(f"[DEBUG] MCP server URL: {self.mcp_server_url}")
        print(f"[DEBUG] Ollama client: {self.ollama_client}")

    async def start_survey_analysis(self, survey_id: str) -> FormAnalysis:
        await self.publish_survey_status(survey_id, SurveyStatus.UNDER_ANALYSIS)
        today = datetime.now().strftime("%Y-%m-%d")
        # Phase 1: Investigation
        messages = [{
            "role": "user",
            "content": (
                f"Investigate the survey with ID {survey_id}. "
                f"Use the available tools to fetch all relevant data (metadata, questions, answers, etc). "
                f"Today is {today}. We run this analysis on {self.model}. "
                "You have to use the tools to get the data. Do not generate the final analysis yet."
                "ignore status of the survey, it's not important for the analysis."
            )
        }]
        async with sse_client(self.mcp_server_url) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                tools_response = await session.list_tools()
                ollama_tools = [
                    {
                        "type": "function",
                        "function": {
                            "name": tool.name,
                            "description": tool.description,
                            "parameters": tool.inputSchema
                        }
                    }
                    for tool in tools_response.tools
                ]

                while True:
                    response = await self.ollama_client.chat(
                        model=self.model,
                        messages=messages,
                        tools=ollama_tools,
                    )
                    if response.message.tool_calls:
                        for tool_call in response.message.tool_calls:
                            args = tool_call.function.arguments
                            if isinstance(args, str):
                                args = json.loads(args)
                            tool_result = await session.call_tool(tool_call.function.name, dict(args) if args else {})
                            content0 = tool_result.content[0] if tool_result.content else None
                            if isinstance(content0, dict) and 'text' in content0:
                                result_content = content0['text']
                            elif hasattr(content0, 'text') and isinstance(getattr(content0, 'text', None), str):
                                result_content = getattr(content0, 'text')
                            elif content0 is not None:
                                result_content = str(content0)
                            else:
                                result_content = "No result"
                            messages.append({
                                "role": "tool",
                                "name": tool_call.function.name,
                                "content": result_content
                            })
                        continue
                    else:
                        # Investigation phase complete
                        break

        # Phase 2: Structured Output
        messages.append({
            "role": "user",
            "content": (
                "Now, using the information above, generate the JSON output in the required format. "
                "The output must match this schema exactly, if you don't know any value, leave it empty or put 0 if it's a number."
            )
        })
        response = await self.ollama_client.chat(
            model=self.model,
            messages=messages,
            format=FormAnalysis.model_json_schema()
        )
        try:
            return json.loads(response.message.content or "")
        except Exception as e:
            logger.error(f"JSON parsing failed: {e}", exc_info=True)
            return await self._create_fallback_analysis(survey_id, response.message.content or "No content received")

    async def _create_fallback_analysis(self, survey_id: str, content: str) -> FormAnalysis:
        await self.publish_survey_status(survey_id, SurveyStatus.ANALYSIS_ERROR)
        logger.debug(f"🛡️ Creating fallback analysis for survey {survey_id}")
        logger.debug(f"📄 Fallback content: {content[:200]}...")
        return FormAnalysis(
            formId=survey_id,
            analysis=Analysis(
                generatedAt=datetime.now().isoformat(),
                model=self.model,
                summary=OverallSummary(
                    overall=content,
                    strengths=[],
                    areasForImprovement=[],
                    recommendations=[],
                    keyQuotes=[]
                ),
                numericalSummary=NumericalSummary(
                    sentimentDistribution=SentimentDistribution(positive=0, neutral=0, negative=0),
                    topicFrequencies=[],
                    averageExperienceYears=None,
                    mostMentionedTech=[]
                ),
                segmentation=[],
                questions=[]
            )
        )

    async def publish_survey_status(self, survey_id: str, status: SurveyStatus):
        await publish_survey_status(survey_id, status)
