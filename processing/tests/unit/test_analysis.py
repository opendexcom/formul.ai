from uuid import uuid4
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.services.analysis_service import AnalysisService

@pytest.mark.asyncio
async def test_analysis_service__start_survey_analysis(mock_client, mocked_response, mock_chat):
    # Mock MCP components
    mock_tool = MagicMock()
    mock_tool.name = "mcp_my-mcp-survey_Find_Survey"
    mock_tool.description = "Find survey metadata and questions by Form ID"
    mock_tool.inputSchema = {
        "type": "object",
        "properties": {
            "id": {"type": "string", "format": "uuid"}
        },
        "required": ["id"]
    }

    mock_tools_response = MagicMock()
    mock_tools_response.tools = [mock_tool]

    mock_session = AsyncMock()
    mock_session.initialize = AsyncMock()
    mock_session.list_tools = AsyncMock(return_value=mock_tools_response)
    mock_session.call_tool = AsyncMock()

    # Mock the SSE client context manager
    mock_sse_client = AsyncMock()
    mock_sse_client.__aenter__ = AsyncMock(return_value=(MagicMock(), MagicMock()))
    mock_sse_client.__aexit__ = AsyncMock(return_value=None)

    # Mock ClientSession context manager
    mock_client_session = AsyncMock()
    mock_client_session.__aenter__ = AsyncMock(return_value=mock_session)
    mock_client_session.__aexit__ = AsyncMock(return_value=None)

    with patch('app.services.analysis_service.sse_client', return_value=mock_sse_client), \
         patch('app.services.analysis_service.ClientSession', return_value=mock_client_session):
        
        analysis_service = AnalysisService(mock_client, "http://localhost:8080/sse")

        # Prepare test data
        local_survey_id = uuid4()
        
        # Mock Ollama response to not have tool calls (final response)
        mocked_response.message.tool_calls = None
        mocked_response.message.content = '{"formId": "test", "analysis": {"generatedAt": "2023-01-01", "model": "test"}}'

        response = await analysis_service.start_survey_analysis(str(local_survey_id))

        # Handle both dict and FormAnalysis return types
        if isinstance(response, dict):
            assert response["formId"] == "test"
            assert response["analysis"]["model"] == "test"
        else:
            assert response.formId == "test"
            assert response.analysis.model == "test"

        assert mock_chat.call_count == 2


@pytest.mark.asyncio
async def test_analysis_service__start_survey_analysis_with_tool_calls():
    """Test analysis service with MCP tool calls"""
    # Create mock Ollama client
    mock_ollama_client = AsyncMock()
    
    # Mock tool call object
    mock_tool_call = MagicMock()
    mock_tool_call.function.name = "mcp_my-mcp-survey_Find_Survey"
    mock_tool_call.function.arguments = '{"id": "test-survey-id"}'
    
    # First response with tool calls, second response without
    first_response = MagicMock()
    first_response.message.content = "I need to fetch the survey data first."
    first_response.message.tool_calls = [mock_tool_call]
    
    second_response = MagicMock()
    second_response.message.content = '{"formId": "test-survey-id", "analysis": {"generatedAt": "2023-01-01", "model": "mistral:latest"}}'
    second_response.message.tool_calls = None
    
    mock_ollama_client.chat.side_effect = [first_response, second_response, second_response]

    # Mock MCP components
    mock_tool = MagicMock()
    mock_tool.name = "mcp_my-mcp-survey_Find_Survey"
    mock_tool.description = "Find survey metadata and questions by Form ID"
    mock_tool.inputSchema = {
        "type": "object",
        "properties": {
            "id": {"type": "string", "format": "uuid"}
        },
        "required": ["id"]
    }

    mock_tools_response = MagicMock()
    mock_tools_response.tools = [mock_tool]

    # Mock tool result
    mock_tool_result = MagicMock()
    mock_tool_result.content = [MagicMock()]
    mock_tool_result.content[0].text = '{"survey_name": "Test Survey", "questions": []}'

    mock_session = AsyncMock()
    mock_session.initialize = AsyncMock()
    mock_session.list_tools = AsyncMock(return_value=mock_tools_response)
    mock_session.call_tool = AsyncMock(return_value=mock_tool_result)

    # Mock the SSE client context manager
    mock_sse_client = AsyncMock()
    mock_sse_client.__aenter__ = AsyncMock(return_value=(MagicMock(), MagicMock()))
    mock_sse_client.__aexit__ = AsyncMock(return_value=None)

    # Mock ClientSession context manager
    mock_client_session = AsyncMock()
    mock_client_session.__aenter__ = AsyncMock(return_value=mock_session)
    mock_client_session.__aexit__ = AsyncMock(return_value=None)

    with patch('app.services.analysis_service.sse_client', return_value=mock_sse_client), \
         patch('app.services.analysis_service.ClientSession', return_value=mock_client_session):
        
        analysis_service = AnalysisService(mock_ollama_client, "http://localhost:8080/sse")

        response = await analysis_service.start_survey_analysis("test-survey-id")

        # Verify the response is parsed JSON
        if isinstance(response, dict):
            assert response["formId"] == "test-survey-id"
            assert response["analysis"]["model"] == "mistral:latest"
        else:
            assert response.formId == "test-survey-id"
            assert response.analysis.model == "mistral:latest"

        # Verify MCP tools were called (should be 1 call for find_survey in this mock setup)
        assert mock_session.call_tool.call_count == 1
        
        # Verify the specific tool call matches the expected MCP tool call
        calls = mock_session.call_tool.call_args_list
        assert calls[0][0][0] == "mcp_my-mcp-survey_Find_Survey"
        assert calls[0][0][1] == {"id": "test-survey-id"}
        
        # Verify Ollama chat was called three times (per mock setup)
        assert mock_ollama_client.chat.call_count == 3
