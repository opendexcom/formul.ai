import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { ResponseDocument } from '../../schemas/response.schema';
import { Form } from '../../schemas/form.schema';

/**
 * Prompt Builder Utility
 * 
 * Responsible for constructing LLM prompts for various analytics tasks:
 * - Topic extraction (in-vivo coding)
 * - Sentiment analysis (overall per response)
 * - Quote extraction (representative samples)
 * - Topic clustering (canonical mapping)
 * - Summary generation
 */
@Injectable()
export class PromptBuilder {
  
  /**
   * Build prompt for extracting topics from responses using in-vivo coding
   */
  buildTopicExtractionPrompt(responses: ResponseDocument[], form: Form): string {
    const responsesData = responses.map((r) => {
      const normalizedAnswers = r.answers
        .map(ans => {
          const question = form.questions.find(q => q.id === ans.questionId);
          const qType = question?.type;

          // Only include textual answers by default
          const isTextual = qType === 'text' || qType === 'textarea';

          // Prefer precomputed normalized value if present
          const normalized = (ans as any).metadata?.normalizedValue as string | undefined;
          // Normalize value to a string
          let displayValue: string = normalized ?? '';
          const v = (ans as any).value;
          if (typeof v === 'string') {
            displayValue = displayValue || v;
          } else if (Array.isArray(v)) {
            displayValue = displayValue || v.filter(Boolean).join(', ');
          } else if (v && typeof v === 'object') {
            // Common case: { other: "..." } or choice objects
            displayValue = displayValue || (v.other ?? v.label ?? JSON.stringify(v));
          } else if (typeof v === 'number' || typeof v === 'boolean') {
            displayValue = displayValue || String(v);
          }

          // Skip clearly non-textual answers for topic extraction
          if (!isTextual && (!displayValue || displayValue.length < 2)) {
            return null;
          }

          return {
            questionId: ans.questionId,
            questionTitle: question?.title,
            value: displayValue
          };
        })
        .filter(Boolean) as Array<{ questionId: string; questionTitle?: string; value: string }>;

      const combinedText = normalizedAnswers.map(a => a.value).join('\n');

      return {
        responseId: (r._id as Types.ObjectId).toString(),
        answers: normalizedAnswers,
        combinedText
      };
    });

    return `CRITICAL: You MUST return ONLY valid JSON. No explanations, no markdown, no prose.

Task: Extract topics from ${responses.length} survey responses using in-vivo coding.
Use ONLY the textual content provided. Focus on semantic themes across answers for each response.

Responses (only textual answers included, with a combinedText helper field):
${JSON.stringify(responsesData, null, 2)}

REQUIRED OUTPUT FORMAT (valid JSON object with "results" array):
{
  "results": [{
    "responseId": "string",
    "topics": [
      {
        "topic": "string",
        "inVivoCode": "string",
        "confidence": 0.0,
        "isPrimary": true
      }
    ]
  }]
}

RULES:
- Output MUST be valid JSON object (test with JSON.parse)
- Root must be an object with "results" array
- MUST include ALL ${responses.length} responses in results array (one per response)
- Topics can be empty array [] if no clear topics found
- Do NOT include any text before or after the JSON
- Do NOT use markdown code blocks
- Do NOT add explanations
- Confidence must be between 0 and 1
- isPrimary must be boolean (true/false)`;
  }

  /**
   * Build prompt for analyzing OVERALL sentiment per response
   * Note: Per-question sentiment is calculated mathematically later
   */
  buildOverallSentimentPrompt(responses: ResponseDocument[], form: Form): string {
    const responsesData = responses.map((r) => {
      const normalizedAnswers = r.answers
        .map(ans => {
          const question = form.questions.find(q => q.id === ans.questionId);
          const qType = question?.type;

          const isTextual = qType === 'text' || qType === 'textarea';

          // Prefer precomputed normalized value if present
          const normalized = (ans as any).metadata?.normalizedValue as string | undefined;
          let displayValue: string = normalized ?? '';
          const v = (ans as any).value;
          if (typeof v === 'string') {
            displayValue = displayValue || v;
          } else if (Array.isArray(v)) {
            displayValue = displayValue || v.filter(Boolean).join(', ');
          } else if (v && typeof v === 'object') {
            displayValue = displayValue || (v.other ?? v.label ?? JSON.stringify(v));
          } else if (typeof v === 'number' || typeof v === 'boolean') {
            displayValue = displayValue || String(v);
          }

          if (!isTextual && (!displayValue || displayValue.length < 2)) {
            return null;
          }

          return {
            questionId: ans.questionId,
            questionTitle: question?.title,
            value: displayValue
          };
        })
        .filter(Boolean) as Array<{ questionId: string; questionTitle?: string; value: string }>;

      const combinedText = normalizedAnswers.map(a => a.value).join('\n');

      return {
        responseId: (r._id as Types.ObjectId).toString(),
        answers: normalizedAnswers,
        combinedText
      };
    });

    return `CRITICAL: You MUST return ONLY valid JSON. No explanations, no markdown, no prose.

Task: Analyze OVERALL sentiment for ${responses.length} survey responses.
Focus on the respondent's general feeling/tone across ALL their answers.

Responses (only textual answers included, with a combinedText helper field):
${JSON.stringify(responsesData, null, 2)}

REQUIRED OUTPUT FORMAT (valid JSON object with "results" array):
{
  "results": [{
    "responseId": "string",
    "overallSentiment": {
      "sentiment": "positive",
      "score": 0.5,
      "emotionalTone": "satisfied",
      "confidence": 0.8,
      "reasoning": "brief explanation"
    }
  }]
}

RULES:
- Output MUST be valid JSON object (test with JSON.parse)
- Root must be an object with "results" array
- MUST include ALL ${responses.length} responses in results array (one per response)
- Do NOT include any text before or after the JSON
- Do NOT use markdown code blocks
- Do NOT add explanations
- sentiment must be: "positive", "neutral", "negative", or "ambivalent"
- score must be between -1 and 1
- confidence must be between 0 and 1
- Analyze OVERALL sentiment only (question-level calculated separately)`;
  }

  /**
   * Build prompt for extracting representative quotes from responses
   */
  buildQuoteExtractionPrompt(responses: ResponseDocument[], form: Form): string {
    const responsesData = responses.map((r) => ({
      responseId: (r._id as Types.ObjectId).toString(),
      answers: r.answers.map(ans => {
        const question = form.questions.find(q => q.id === ans.questionId);
        return { 
          questionId: ans.questionId, 
          questionTitle: question?.title, 
          value: ans.value 
        };
      })
    }));

    return `CRITICAL: You MUST return ONLY valid JSON. No explanations, no markdown, no prose.

Task: Select representative quotes from ${responses.length} survey responses.

Responses:
${JSON.stringify(responsesData, null, 2)}

REQUIRED OUTPUT FORMAT (valid JSON object with "results" array):
{
  "results": [{
    "responseId": "string",
    "quotes": [
      {
        "text": "exact quote text",
        "questionId": "string",
        "representativeness": 0.8,
        "impact": 0.7,
        "themes": ["theme1", "theme2"]
      }
    ],
    "responseQuality": {
      "completeness": 0.9,
      "depth": 0.7,
      "clarity": 0.8
    }
  }]
}

RULES:
- Output MUST be valid JSON object (test with JSON.parse)
- Root must be an object with "results" array
- Do NOT include any text before or after the JSON
- Do NOT use markdown code blocks
- Do NOT add explanations
- All numeric values (representativeness, impact, completeness, depth, clarity) must be between 0 and 1
- text must be exact quote from responses
- themes must be array of strings
- quotes can be empty array [] if no representative quotes found`;
  }

  /**
   * Build prompt for clustering raw topics into canonical categories
   */
  buildTopicClusteringPrompt(rawTopics: string[]): string {
    return `You are a topic clustering expert. Map each raw topic to a canonical category name.
Topics may be similar but phrased differently (e.g., "Web Dev", "web development", "building websites" → "Web Development").
Topics in different languages with same meaning should map to same canonical name.

Raw topics to cluster:
${JSON.stringify(rawTopics, null, 2)}

REQUIRED OUTPUT FORMAT (valid JSON object):
{
  "mapping": {
    "raw topic 1": "Canonical Category 1",
    "raw topic 2": "Canonical Category 1",
    "raw topic 3": "Canonical Category 2"
  }
}

RULES:
- Output MUST be valid JSON object with "mapping" property
- Each raw topic MUST appear exactly once as a key in mapping
- Canonical names should be clear, concise, title-cased
- Group semantically similar topics under same canonical name
- Preserve language diversity but use English for canonical names
- Do NOT add explanations, only return JSON`;
  }

  /**
   * Build prompt for generating analytics summary
   * This matches the original implementation in analytics.service.ts
   */
  buildAnalyticsSummaryPrompt(
    form: Form,
    topTopics: string[],
    sentimentDistribution: any,
    responseCount: number,
    topicQuotes: Array<{ topic: string; quote: string; count: number }>,
    closedQuestionStats: any[],
    closedQuestionInsights: any[]
  ): string {
    const formContext = {
      title: form.title,
      description: form.description || 'No description provided',
      totalQuestions: form.questions.length,
    };

    const analyticsContext = {
      responseCount,
      topTopics: topTopics.slice(0, 3),
      sentiment: {
        positive: sentimentDistribution.positive,
        neutral: sentimentDistribution.neutral,
        negative: sentimentDistribution.negative,
      },
      topicQuotes,
      closedQuestions: closedQuestionStats,
      closedQuestionInsights
    };

    return `You are a professional data analyst writing an executive summary of survey analytics.

FORM CONTEXT (for understanding direction, do NOT repeat in summary):
- Title: "${formContext.title}"
- Description: "${formContext.description}"
- Questions: ${formContext.totalQuestions} questions

ANALYSIS RESULTS:
- Total responses: ${analyticsContext.responseCount}
- Main topics discussed: ${analyticsContext.topTopics.join(', ')}
- Sentiment: ${analyticsContext.sentiment.positive}% positive, ${analyticsContext.sentiment.neutral}% neutral, ${analyticsContext.sentiment.negative}% negative

${analyticsContext.closedQuestions.length > 0 ? `CLOSED QUESTION RESPONSES:
${analyticsContext.closedQuestions.map((d: any) => 
  `${d.question}: ${d.topAnswers.map((a: any) => `${a.value} (${a.percentage}%)`).join(', ')}`
).join('\n')}` : ''}

${analyticsContext.closedQuestionInsights.length > 0 ? `TOPIC PATTERNS BY RESPONSE:
${analyticsContext.closedQuestionInsights.map((di: any) => 
  `• ${di.answer} (${di.count} responses) primarily discuss ${di.topTopic} (${di.topicPercentage}% of their topics)`
).join('\n')}` : ''}

Sample responses from top topics:
${analyticsContext.topicQuotes.map((tq: any) => `• ${tq.topic} (${tq.count} responses): "${tq.quote}"`).join('\n')}

TASK:
Write a professional, structured executive summary using this exact format:

**FORMAT TEMPLATE:**
[Opening paragraph: 2-3 sentences providing overview of what respondents revealed in relation to the form's purpose. Include 1 direct citation with quotation marks to illustrate the main theme. Use **bold** for key metrics or emphasis. Consider mentioning key response patterns if significant.]

**Key Takeaways:**
- [First main finding - clear, actionable insight, may reference response patterns]
- [Second main finding - include citation if relevant: "quote"]
- [Third main finding - emphasize with **bold** if important, may reference response segmentation]

**REQUIREMENTS:**
1. Opening paragraph:
   - Focus on outcomes and what respondents revealed (NOT describing the survey)
   - Mention overall sentiment (e.g., "Sentiment is **strongly positive** (${analyticsContext.sentiment.positive}%)")
   - Include 1 direct citation with quotation marks to make it respondent-oriented
   - Use **bold** for key numbers or emphasis
   - Optionally mention response patterns if they provide valuable context

2. Key Takeaways (3 bullet points):
   - Each takeaway should be clear, concise, and actionable
   - Include citations where relevant to show respondent voice
   - Use **bold** for emphasis on important words/metrics
   - Focus on insights decision-makers can act on
   - May reference response patterns if they reveal important insights (e.g., "those who selected X prioritize Y")

3. Style:
   - Professional, objective tone suitable for business/academic contexts
   - Direct quotes in "quotation marks" with proper context
   - Use **bold** strategically for emphasis (not excessively)
   - Maximum 120 words total
   - Response pattern references should be natural and add value, not forced

4. FORMATTING RULES (CRITICAL):
   - Use ONLY plain text and markdown syntax
   - For bold: **text** (double asterisks)
   - For emphasis: plain quotes "text" (no HTML tags)
   - DO NOT use HTML tags like <strong>, <em>, <b>, etc.
   - DO NOT add class attributes or any HTML
   - Output must be pure text with markdown only

CRITICAL: Return ONLY the formatted summary as plain text with markdown. No preamble, no "Here is...", no markdown code blocks, no HTML tags. Start directly with the opening paragraph.`;
  }

  /**
   * Build prompt for analyzing if topics truly need consolidation or are well-clustered
   */
  buildTopicConsolidationAnalysisPrompt(topics: string[]): string {
    return `You are an expert in qualitative data analysis. Analyze if these ${topics.length} topics are well-organized or need further consolidation.

TOPICS (already clustered/canonical):
${JSON.stringify(topics, null, 2)}

TASK:
Determine if these topics represent a scattered focus that needs consolidation, or if they're appropriately diverse and well-organized.

Consider:
1. Semantic overlap - Are there topics that mean essentially the same thing?
2. Theme coherence - Do topics cluster naturally into broader themes?
3. Appropriate granularity - Is this level of detail useful or overwhelming?
4. Context - ${topics.length} topics for a survey analysis (8-12 is optimal, 15+ often needs grouping)

REQUIRED OUTPUT FORMAT (valid JSON object):
{
  "needsConsolidation": true,
  "recommendation": "string - main recommendation text",
  "basedOn": "string - what data/pattern supports this (mention specific number of topics and key observation)",
  "suggestedAction": "string - specific actionable advice (e.g., 'Group X, Y, Z into \"Theme A\", combine A and B into \"Theme B\", etc.')",
  "expectedImpact": "string - concrete benefits of following this advice",
  "confidence": "high|medium|low",
  "reasoning": "string - brief explanation of your analysis"
}

RULES:
- Output MUST be valid JSON object
- If topics are well-organized (distinct, clear, appropriate number): needsConsolidation = false, confidence = "high"
- If topics show overlap/confusion: needsConsolidation = true, provide specific grouping suggestions
- Be specific in suggestedAction - mention actual topic names and how to group them
- basedOn should reference the actual number of topics and key patterns
- Do NOT add explanations outside the JSON
- Return ONLY the JSON object`;
  }
}
