import asyncio
import json
import redis.asyncio as redis
from datetime import datetime
import traceback
from app.services.task_service import TaskService
from app.services.analysis_service import AnalysisService
from app.models.task_status import TaskStatus
from app.utils.redis_publisher import SurveyStatus
import logging
from app.api.deps import get_redis, get_settings
from app.repository.task_repository import TaskRepository
from app.db.sessions import get_async_engine, get_async_session_factory
from ollama import AsyncClient
import os

logger = logging.getLogger(__name__)

async def process_analysis_job(job_data: dict):
    """Process a single analysis job"""
    survey_id = job_data["survey_id"]
    task_id = job_data["task_id"]
    
    logger.info(f"Processing analysis for survey {survey_id}")
    
    try:
        # Initialize services directly (no dependency injection)
        settings = get_settings()
        
        # Create database session factory
        engine = get_async_engine(settings.database)
        session_factory = get_async_session_factory(engine)
        
        # Create task repository and service
        task_repository = TaskRepository(session_factory=session_factory)
        task_service = TaskService(task_repository=task_repository)
        
        # Create Ollama client
        ollama_client = AsyncClient(host=str(settings.ollama_api_url))
        
        # Create analysis service
        analysis_service = AnalysisService(
            ollama_client=ollama_client,
            mcp_server_url=settings.mcp_server_url
        )
        
        start_time = datetime.now()
        logger.info(f"Starting analysis for survey {survey_id}")
        
        # Your long-waiting analysis
        analysis_result = await analysis_service.start_survey_analysis(survey_id)
        
        end_time = datetime.now()
        logger.info(f"Finished analysis for survey {survey_id} in {end_time - start_time}")
        
        # Complete the task
        await task_service.complete_task(task_id, analysis_result)
        await analysis_service.publish_survey_status(survey_id, SurveyStatus.ANALYSIS_DONE)
        
        logger.info(f"Analysis completed successfully for survey {survey_id}")
        
    except Exception as e:
        logger.error(f"Analysis failed for survey {survey_id}: {e}", stack_info=True, exc_info=True)
        # Create analysis service for error publishing if it wasn't created above
        try:
            settings = get_settings()
            ollama_client = AsyncClient(host=str(settings.ollama_api_url))
            analysis_service = AnalysisService(
                ollama_client=ollama_client,
                mcp_server_url=settings.mcp_server_url
            )
            await analysis_service.publish_survey_status(survey_id, SurveyStatus.ANALYSIS_ERROR)
        except Exception as publish_error:
            logger.error(f"Failed to publish error status: {publish_error}", exc_info=True)

async def worker():
    """Main worker loop"""
    redis_client = await get_redis()
    
    logger.info("Worker started, waiting for jobs...")
    
    while True:
        try:
            # Wait for a job (blocking)
            result = await redis_client.brpop("analysis_queue", timeout=1)
            
            if result:
                _, job_json = result
                job_data = json.loads(job_json)
                
                # Process the job
                await process_analysis_job(job_data)
            else:
                # No jobs available, continue loop
                continue
                
        except Exception as e:
            logger.error(f"Worker error: {e}", exc_info=True)
            await asyncio.sleep(1)  # Wait before retrying

if __name__ == "__main__":
    asyncio.run(worker())
