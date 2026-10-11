# Issue 3: Timeout or guardian rejection + “Retry” loses PDF context

**Scope:** Form Editor `AIFormChat` + document stream endpoint.  
**Related:** [README](./README.md) · [Issue 2](./issue-02-verification-build-expensive.md) (guardian / timeouts)

## What users see

After a network error, stream error, **timeout**, or **guardian rejection**, the chat shows an error and a **Retry** control. Retrying often produces a **different** result or runs the **wrong** pipeline because the PDF is no longer part of the request.

## Why it happens (technical)

- On send, the client stores only the **text** prompt in `lastPrompt`, then **clears** the attachment from state (`setAttachedFile(null)`). The file is not kept in memory for a resend.

```101:107:client/src/components/FormEditor/AIFormChat.tsx
    setMessages(prev => [...prev, userMessage]);
    setLastPrompt(effectivePrompt);
    setInput('');
    setAttachedFile(null);
    setIsProcessing(true);
```

- **Retry** resends **text only** — `handleRetry` calls `sendPrompt(lastPrompt, null)`, so the second attempt uses **`/ai/generate-stream`** (no document), not `generate-stream-from-document`.

```220:223:client/src/components/FormEditor/AIFormChat.tsx
  const handleRetry = async () => {
    if (!lastPrompt) return;
    await sendPrompt(lastPrompt, null);
  };
```

So after a failed PDF run, **Retry** is not “retry the same PDF job”; it is “run a **new** text-only generation with the same short instruction string,” which **changes model inputs and routing** and naturally **diverges** from the first attempt.

- **Additional UX detail:** `processingSteps` are cleared after 2 seconds in `finally`, so users also lose visible partial progress from the failed run, which makes failures feel more abrupt and encourages blind retry.

## Net effect

Failures on the document path are **not resumable** from the UI; users must **re-attach the PDF** and send again, and there is no idempotent “same job, same bytes” semantics.
