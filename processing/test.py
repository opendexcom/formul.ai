
import asyncio
import json
import logging
import sys
import app.services.analysis_service as analysis_service

from app.schemas.survey_points import FormAnalysis
from ollama import AsyncClient

# Configure logging to show debug messages
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)

# Ensure our analysis service logger shows debug messages
analysis_logger = logging.getLogger('app.services.analysis_service')
analysis_logger.setLevel(logging.DEBUG)

# Reduce noise from other loggers
logging.getLogger('httpcore').setLevel(logging.WARNING)
logging.getLogger('httpx').setLevel(logging.WARNING)
logging.getLogger('ollama').setLevel(logging.WARNING)

async def main():
    print("🧪 Starting Analysis Service Test with Debug Logging")
    print("=" * 60)
    
    ollama_client = AsyncClient()
    analysis_service_instance = analysis_service.AnalysisService(
        ollama_client=ollama_client, 
        mcp_server_url="http://localhost:8080/sse"
    )
    result = await analysis_service_instance.start_survey_analysis("92554d04-7f15-4fdf-8079-d506b9bfcfad")
    
    print("\n" + "=" * 60)
    print("🎯 FINAL ANALYSIS RESULT:")
    print("=" * 60)
    print(json.dumps(result, indent=2, default=str))

if __name__ == "__main__":
    asyncio.run(main())
