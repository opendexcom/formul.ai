import { SemanticLlmCacheService } from './semantic-llm-cache.service';

describe('SemanticLlmCacheService', () => {
  it('resolveScopeId uses user scope', () => {
    process.env.LLM_SEMANTIC_CACHE_ENABLED = 'false';
    const service = new SemanticLlmCacheService();
    const scopeId = service.resolveScopeId(
      { enabled: true, mode: 'semantic', scope: 'user' },
      { userId: 'user-123' },
    );
    expect(scopeId).toBe('user-123');
  });

  it('resolveScopeId combines user and document hash', () => {
    const service = new SemanticLlmCacheService();
    const scopeId = service.resolveScopeId(
      { enabled: true, mode: 'exact', scope: 'user_document' },
      { userId: 'u1', documentHash: 'abc' },
    );
    expect(scopeId).toBe('u1:abc');
  });
});
