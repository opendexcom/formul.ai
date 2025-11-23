# Rate Limiting Strategy

**Status:** 📝 Future Implementation  
**Last Updated:** November 23, 2025

---

## Overview

This document outlines the planned rate limiting strategy for the FormulAI application to prevent abuse and ensure fair resource usage, particularly for AI-powered endpoints.

---

## Current State

Currently, the application has **no rate limiting** implemented on either the client or server side. This creates potential risks:

- **AI Generation Abuse:** Users could spam the AI form generation endpoint, consuming expensive API credits
- **Analytics Processing:** Repeated analytics refresh requests could overload the system
- **Form Submission Spam:** Public forms are vulnerable to spam submissions
- **Resource Exhaustion:** Malicious users could exhaust server resources

---

## Proposed Implementation

### 1. Backend Rate Limiting (Primary)

#### API-Level Rate Limiting

Implement rate limiting middleware on the server using libraries like `express-rate-limit`:

```typescript
// server/src/middleware/rateLimiter.ts
import rateLimit from 'express-rate-limit';

// General API rate limiter
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict limiter for AI endpoints
export const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 AI generations per hour
  message: 'AI generation limit reached. Please try again later.',
  skipSuccessfulRequests: false,
});

// Analytics refresh limiter
export const analyticsLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3, // 3 refreshes per 5 minutes
  message: 'Analytics refresh limit reached. Please wait before refreshing again.',
});

// Form submission limiter (per form)
export const formSubmissionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 submissions per minute
  message: 'Too many form submissions. Please slow down.',
});
```

#### User-Based Rate Limiting

For authenticated users, implement per-user rate limits:

```typescript
// server/src/middleware/userRateLimiter.ts
import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

interface RateLimitConfig {
  points: number; // Number of requests
  duration: number; // Time window in seconds
}

export const createUserRateLimiter = (config: RateLimitConfig) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.id;
    if (!userId) {
      return next(); // Skip for unauthenticated requests
    }

    const key = `rate-limit:${userId}:${req.path}`;
    const current = await redis.incr(key);
    
    if (current === 1) {
      await redis.expire(key, config.duration);
    }

    if (current > config.points) {
      const ttl = await redis.ttl(key);
      return res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfter: ttl,
      });
    }

    res.setHeader('X-RateLimit-Limit', config.points.toString());
    res.setHeader('X-RateLimit-Remaining', (config.points - current).toString());
    
    next();
  };
};
```

#### Endpoint-Specific Limits

Apply different limits to different endpoints:

```typescript
// server/src/routes/ai.routes.ts
router.post('/generate', 
  authenticate,
  aiLimiter,
  createUserRateLimiter({ points: 20, duration: 3600 }), // 20 per hour per user
  aiController.generate
);

// server/src/routes/forms.routes.ts
router.post('/:id/analytics/refresh',
  authenticate,
  analyticsLimiter,
  formsController.refreshAnalytics
);

router.post('/:formId/responses',
  formSubmissionLimiter,
  responsesController.create
);
```

### 2. Client-Side Rate Limiting (Secondary)

Implement client-side rate limiting as a UX improvement and first line of defense:

```typescript
// client/src/hooks/useRateLimit.ts
import { useRef, useCallback } from 'react';

interface RateLimitConfig {
  maxCalls: number;
  windowMs: number;
}

export const useRateLimit = (config: RateLimitConfig) => {
  const callTimestamps = useRef<number[]>([]);

  const checkRateLimit = useCallback((): { allowed: boolean; retryAfter?: number } => {
    const now = Date.now();
    const windowStart = now - config.windowMs;
    
    // Remove old timestamps
    callTimestamps.current = callTimestamps.current.filter(
      timestamp => timestamp > windowStart
    );

    if (callTimestamps.current.length >= config.maxCalls) {
      const oldestCall = callTimestamps.current[0];
      const retryAfter = Math.ceil((oldestCall + config.windowMs - now) / 1000);
      return { allowed: false, retryAfter };
    }

    callTimestamps.current.push(now);
    return { allowed: true };
  }, [config]);

  return { checkRateLimit };
};
```

#### Usage in Components

```typescript
// client/src/components/FormEditor/AIFormChat.tsx
const { checkRateLimit } = useRateLimit({ 
  maxCalls: 20, 
  windowMs: 60 * 60 * 1000 // 20 calls per hour
});

const sendPrompt = async (promptText: string) => {
  const { allowed, retryAfter } = checkRateLimit();
  
  if (!allowed) {
    setErrorMessage(
      `Rate limit reached. Please try again in ${retryAfter} seconds.`
    );
    return;
  }

  // Proceed with API call
  // ...
};
```

### 3. Debouncing and Throttling

Implement debouncing for user inputs and throttling for expensive operations:

```typescript
// client/src/hooks/useDebounce.ts
import { useEffect, useState } from 'react';

export const useDebounce = <T,>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

// Usage
const debouncedSearchTerm = useDebounce(searchTerm, 500);
```

---

## Rate Limit Tiers

### Free Tier (Unauthenticated)
- **Form Submissions:** 5 per minute per IP
- **Public Form Views:** 100 per hour per IP

### Authenticated Users
- **AI Form Generation:** 20 per hour
- **Analytics Refresh:** 3 per 5 minutes
- **Form Creation:** 10 per hour
- **Form Submissions:** 50 per hour
- **API Requests:** 1000 per hour

### Premium Tier (Future)
- **AI Form Generation:** 100 per hour
- **Analytics Refresh:** 10 per 5 minutes
- **Form Creation:** Unlimited
- **API Requests:** 5000 per hour

---

## Error Handling

### Backend Response Format

```json
{
  "error": "Rate limit exceeded",
  "message": "Too many AI generation requests. Please try again later.",
  "retryAfter": 3600,
  "limit": 20,
  "remaining": 0,
  "resetAt": "2025-11-23T21:30:00Z"
}
```

### Client-Side Error Display

```typescript
// client/src/components/ui/RateLimitError.tsx
interface RateLimitErrorProps {
  retryAfter: number; // seconds
  onRetry?: () => void;
}

export const RateLimitError: React.FC<RateLimitErrorProps> = ({ 
  retryAfter, 
  onRetry 
}) => {
  const [countdown, setCountdown] = useState(retryAfter);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <Alert type="warning">
      <p>Rate limit reached. You can try again in {countdown} seconds.</p>
      {countdown === 0 && onRetry && (
        <Button onClick={onRetry}>Retry Now</Button>
      )}
    </Alert>
  );
};
```

---

## Monitoring and Analytics

### Metrics to Track

1. **Rate Limit Hits:** Number of requests blocked by rate limiting
2. **Top Rate-Limited Users:** Identify potential abusers
3. **Endpoint-Specific Metrics:** Which endpoints are most rate-limited
4. **False Positives:** Legitimate users hitting limits

### Implementation

```typescript
// server/src/middleware/rateLimitMonitoring.ts
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export const monitorRateLimit = (req: Request, res: Response, next: NextFunction) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    if (res.statusCode === 429) {
      logger.warn('Rate limit hit', {
        userId: req.user?.id,
        ip: req.ip,
        endpoint: req.path,
        method: req.method,
      });
    }
    return originalSend.call(this, data);
  };
  
  next();
};
```

---

## Implementation Checklist

- [ ] Install rate limiting dependencies (`express-rate-limit`, `rate-limiter-flexible`)
- [ ] Set up Redis for distributed rate limiting (if using multiple servers)
- [ ] Implement backend rate limiters for each endpoint category
- [ ] Add rate limit headers to API responses
- [ ] Create client-side rate limiting hooks
- [ ] Implement user-friendly error messages
- [ ] Add rate limit monitoring and logging
- [ ] Document rate limits in API documentation
- [ ] Add rate limit information to user dashboard
- [ ] Test rate limiting under load
- [ ] Configure different limits for different user tiers

---

## Testing Strategy

### Unit Tests

```typescript
// server/src/middleware/__tests__/rateLimiter.test.ts
describe('Rate Limiter', () => {
  it('should allow requests within limit', async () => {
    // Test implementation
  });

  it('should block requests exceeding limit', async () => {
    // Test implementation
  });

  it('should reset after time window', async () => {
    // Test implementation
  });
});
```

### Load Testing

Use tools like Apache Bench or Artillery to test rate limiting under load:

```yaml
# artillery-config.yml
config:
  target: 'http://localhost:3001'
  phases:
    - duration: 60
      arrivalRate: 50
scenarios:
  - name: 'AI Generation Spam'
    flow:
      - post:
          url: '/api/ai/generate'
          headers:
            Authorization: 'Bearer {{token}}'
          json:
            prompt: 'Create a feedback form'
```

---

## Future Enhancements

1. **Adaptive Rate Limiting:** Adjust limits based on server load
2. **User Reputation System:** Trusted users get higher limits
3. **Burst Allowance:** Allow short bursts above the limit
4. **Geographic Rate Limiting:** Different limits for different regions
5. **API Key System:** Programmatic access with dedicated rate limits
6. **Real-time Notifications:** Alert users when approaching limits

---

## References

- [Express Rate Limit Documentation](https://github.com/express-rate-limit/express-rate-limit)
- [Rate Limiter Flexible](https://github.com/animir/node-rate-limiter-flexible)
- [OWASP Rate Limiting Guidelines](https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Cheat_Sheet.html)
- [Redis Rate Limiting Patterns](https://redis.io/docs/manual/patterns/rate-limiter/)
