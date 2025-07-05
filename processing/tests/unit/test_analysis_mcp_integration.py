"""
Test MCP integration with analysis service
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from app.api.deps import get_analysis_service
from app.core.config import Settings, PostgresSettings
from pydantic import SecretStr


@pytest.mark.asyncio
async def test_get_analysis_service_with_mcp_url():
    """Test that the analysis service is properly initialized with MCP URL from settings"""
    # Mock Ollama client
    mock_ollama_client = AsyncMock()
    
    # Create proper PostgresSettings
    postgres_settings = PostgresSettings(
        host="localhost",
        username="test",
        name="test",
        password=SecretStr("test"),
        port=5432
    )
    
    # Mock settings
    mock_settings = Settings(
        database=postgres_settings,
        ollama_api_url="http://localhost:11434",
        mcp_server_url="http://localhost:8080/sse"
    )
    
    # Get the analysis service using the dependency function
    analysis_service = get_analysis_service(mock_ollama_client, mock_settings)
    
    # Verify the service is configured with the correct MCP URL
    assert analysis_service.mcp_server_url == "http://localhost:8080/sse"
    assert analysis_service.ollama_client == mock_ollama_client


@pytest.mark.asyncio
async def test_analysis_service_mcp_connection_error_handling():
    """Test that analysis service handles MCP connection errors gracefully"""
    mock_ollama_client = AsyncMock()
    
    # Create proper PostgresSettings
    postgres_settings = PostgresSettings(
        host="localhost",
        username="test",
        name="test",
        password=SecretStr("test"),
        port=5432
    )
    
    # Mock MCP connection to raise an exception
    with patch('app.services.analysis_service.sse_client') as mock_sse_client:
        mock_sse_client.side_effect = Exception("MCP server connection failed")
        
        analysis_service = get_analysis_service(
            mock_ollama_client, 
            Settings(
                database=postgres_settings,
                ollama_api_url="http://localhost:11434",
                mcp_server_url="http://localhost:8080/sse"
            )
        )
        
        survey_id = str(uuid4())
        with pytest.raises(Exception) as exc_info:
            await analysis_service.start_survey_analysis(survey_id)
        assert "MCP server connection failed" in str(exc_info.value)


@pytest.mark.asyncio
async def test_analysis_service_fallback_on_json_parse_error():
    """Test that analysis service falls back gracefully when JSON parsing fails"""
    mock_ollama_client = AsyncMock()
    
    # Mock MCP components
    mock_session = AsyncMock()
    mock_session.initialize = AsyncMock()
    mock_session.list_tools = AsyncMock(return_value=MagicMock(tools=[]))

    mock_sse_client = AsyncMock()
    mock_sse_client.__aenter__ = AsyncMock(return_value=(MagicMock(), MagicMock()))
    mock_sse_client.__aexit__ = AsyncMock(return_value=None)

    mock_client_session = AsyncMock()
    mock_client_session.__aenter__ = AsyncMock(return_value=mock_session)
    mock_client_session.__aexit__ = AsyncMock(return_value=None)

    # Mock Ollama to return invalid JSON
    mock_response = MagicMock()
    mock_response.message.content = "This is not valid JSON"
    mock_response.message.tool_calls = None
    mock_ollama_client.chat = AsyncMock(return_value=mock_response)

    with patch('app.services.analysis_service.sse_client', return_value=mock_sse_client), \
         patch('app.services.analysis_service.ClientSession', return_value=mock_client_session):
        
        # Create proper PostgresSettings
        postgres_settings = PostgresSettings(
            host="localhost",
            username="test",
            name="test",
            password=SecretStr("test"),
            port=5432
        )
        
        analysis_service = get_analysis_service(
            mock_ollama_client,
            Settings(
                database=postgres_settings,
                ollama_api_url="http://localhost:11434", 
                mcp_server_url="http://localhost:8080/sse"
            )
        )
        
        survey_id = str(uuid4())
        result = await analysis_service.start_survey_analysis(survey_id)
        
        # Should return fallback analysis
        if isinstance(result, dict):
            assert result["formId"] == survey_id
            assert result["analysis"]["summary"]["overall"] == "This is not valid JSON"
        else:
            assert result.formId == survey_id
            assert result.analysis.summary.overall == "This is not valid JSON"
