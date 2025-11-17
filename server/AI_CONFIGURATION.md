# AI/LLM Configuration Guide

The AI form generator supports multiple LLM providers through LangChain's abstraction layer.

## Supported Providers

### 1. OpenAI (Default)
Best for: Production use, high-quality form generation

**Setup:**
```env
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-your-api-key-here
OPENAI_MODEL=gpt-4o-mini
LLM_TEMPERATURE=0.7
```

**Requirements:**
- OpenAI API key from https://platform.openai.com/
- `@langchain/openai` package (already installed)

**Supported Models:**
- `gpt-4o-mini` (recommended, cost-effective)
- `gpt-4o` (highest quality)
- `gpt-3.5-turbo` (legacy, cheaper)

### 2. Ollama (Local)
Best for: Development, privacy, no API costs

**Setup:**
```env
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama2
LLM_TEMPERATURE=0.7
```

**Requirements:**
1. Install Ollama: https://ollama.ai/
2. Pull a model: `ollama pull llama2`
3. `@langchain/community` package (already installed)

**Recommended Models:**
- `llama2` - General purpose, good quality
- `mistral` - Fast and efficient
- `codellama` - Better at structured output
- `phi` - Lightweight, fast responses

**Starting Ollama:**
```bash
# Pull a model
ollama pull llama2

# Start Ollama server (usually auto-starts)
ollama serve

# Test the model
ollama run llama2 "Hello"
```

## Configuration Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `LLM_PROVIDER` | Provider to use: `openai` or `ollama` | `openai` |
| `LLM_TEMPERATURE` | Creativity level (0.0-1.0) | `0.7` |
| `OPENAI_API_KEY` | OpenAI API key | - |
| `OPENAI_MODEL` | OpenAI model name | `gpt-4o-mini` |
| `OLLAMA_BASE_URL` | Ollama server URL | `http://localhost:11434` |
| `OLLAMA_MODEL` | Ollama model name | `llama2` |

## Switching Providers

Simply update `.env` file and restart the server:

```bash
# Switch to OpenAI
LLM_PROVIDER=openai

# Switch to Ollama
LLM_PROVIDER=ollama
```

No code changes needed - LangChain handles the abstraction!

## Performance Comparison

| Feature | OpenAI | Ollama |
|---------|--------|--------|
| Quality | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Speed | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| Cost | $$ | Free |
| Privacy | Cloud | Local |
| Setup | Easy | Medium |

## Troubleshooting

### OpenAI Issues
- **"API key not configured"**: Add `OPENAI_API_KEY` to `.env`
- **Rate limits**: Upgrade your OpenAI plan or add retry logic
- **Model not found**: Check model name spelling

### Ollama Issues
- **"Connection refused"**: Start Ollama with `ollama serve`
- **Model not found**: Pull the model with `ollama pull <model>`
- **Slow responses**: Use a smaller model like `phi` or `tinyllama`
- **JSON parsing errors**: Try `codellama` or `mistral` for better structured output

## Adding More Providers

LangChain supports many providers. To add more:

1. Install the provider package (e.g., `@langchain/anthropic`)
2. Add initialization logic in `ai.service.ts`
3. Update `.env` with provider-specific config
4. Add case to `LLM_PROVIDER` switch

Example providers:
- Anthropic Claude
- Azure OpenAI
- Google PaLM
- Hugging Face
- Cohere
