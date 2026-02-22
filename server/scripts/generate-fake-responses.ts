/**
 * Script to generate fake responses for a form using LLM
 * 
 * Usage:
 *   npx ts-node scripts/generate-fake-responses.ts <formId> [options]
 * 
 * Options:
 *   --count, -c <number>     Total number of responses to generate (default: 10)
 *   --positive, -p <number>  Number of positive sentiment responses
 *   --negative, -n <number>  Number of negative sentiment responses
 *   --neutral, -u <number>   Number of neutral sentiment responses
 * 
 * Examples:
 *   # Generate 10 responses with random sentiment distribution
 *   npx ts-node scripts/generate-fake-responses.ts 693dd792c5a2184364445ae2
 * 
 *   # Generate 50 responses with random sentiment distribution
 *   npx ts-node scripts/generate-fake-responses.ts 693dd792c5a2184364445ae2 --count 50
 * 
 *   # Generate specific sentiment distribution (20 positive, 10 negative, 5 neutral = 35 total)
 *   npx ts-node scripts/generate-fake-responses.ts 693dd792c5a2184364445ae2 -p 20 -n 10 -u 5
 * 
 *   # Mix: 30 total with 10 positive, 10 negative (remaining 10 will be neutral)
 *   npx ts-node scripts/generate-fake-responses.ts 693dd792c5a2184364445ae2 -c 30 -p 10 -n 10
 */

import mongoose, { Types } from 'mongoose';
import * as dotenv from 'dotenv';
import { ChatOpenAI } from '@langchain/openai';

// Load environment variables
dotenv.config();

// Define sentiment types
type SentimentType = 'positive' | 'negative' | 'neutral';

interface SentimentConfig {
  positive: number;
  negative: number;
  neutral: number;
}

// Define schemas inline (to avoid NestJS dependencies)
const QuestionType = {
  TEXT: 'text',
  TEXTAREA: 'textarea',
  MULTIPLE_CHOICE: 'multiple_choice',
  CHECKBOX: 'checkbox',
  DROPDOWN: 'dropdown',
  EMAIL: 'email',
  NUMBER: 'number',
  DATE: 'date',
  TIME: 'time',
  RATING: 'rating',
} as const;

interface Question {
  id: string;
  title: string;
  description?: string;
  type: string;
  required: boolean;
  options?: string[];
  order: number;
  canBeOther?: boolean;
}

interface Form {
  _id: Types.ObjectId;
  title: string;
  description?: string;
  questions: Question[];
}

interface Answer {
  questionId: string;
  value: any;
}

interface ResponseDoc {
  formId: Types.ObjectId;
  answers: Answer[];
  submittedAt: Date;
  metadata: {
    hasTextContent: boolean;
    processedForAnalytics: boolean;
    extractedKeywords: string[];
  };
}

// MongoDB Schemas
const AnswerSchema = new mongoose.Schema({
  questionId: { type: String, required: true },
  value: { type: mongoose.Schema.Types.Mixed, required: true },
  metadata: { type: Object },
});

const ResponseMetadataSchema = new mongoose.Schema({
  hasTextContent: { type: Boolean, default: false },
  extractedKeywords: { type: [String], default: [] },
  processedForAnalytics: { type: Boolean, default: false },
  lastAnalyzed: { type: Date },
  processingTaskId: { type: String },
  processingStartedAt: { type: Date },
  overallSentiment: { type: Object },
  allTopics: { type: [String] },
  canonicalTopics: { type: [String] },
  primaryTopics: { type: [String] },
  topicMapping: { type: Object },
  qualityScore: { type: Number },
  topics: { type: [Object] },
  sentiment: { type: Object },
  discourse: { type: Object },
  quotes: { type: Object },
  fullTextPreserved: { type: Boolean, default: true },
}, { _id: false });

const ResponseSchema = new mongoose.Schema({
  formId: { type: mongoose.Schema.Types.ObjectId, ref: 'Form', required: true },
  respondentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  respondentEmail: { type: String },
  answers: { type: [AnswerSchema], required: true },
  submittedAt: { type: Date, default: Date.now },
  ipAddress: { type: String },
  userAgent: { type: String },
  metadata: { type: ResponseMetadataSchema, default: () => ({ hasTextContent: false, processedForAnalytics: false, extractedKeywords: [] }) },
}, { timestamps: true });

const FormSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  questions: { type: [Object], default: [] },
  isActive: { type: Boolean, default: true },
  isPublic: { type: Boolean, default: false },
  settings: { type: Object },
}, { timestamps: true });

// Initialize LLM (OpenAI only)
function initializeLLM() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured. Set it in your .env file.');
  }
  return new ChatOpenAI({
    apiKey,
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    temperature: 0.8,
  });
}

// Generate a single response using LLM
async function generateSingleResponse(
  llm: any,
  form: Form,
  responseIndex: number,
  totalResponses: number,
  sentiment: SentimentType = 'neutral'
): Promise<Answer[]> {
  const questionPrompts = form.questions
    .sort((a, b) => a.order - b.order)
    .map((q, idx) => {
      let typeInfo = '';
      switch (q.type) {
        case QuestionType.TEXT:
          typeInfo = 'Short text answer (1-2 sentences)';
          break;
        case QuestionType.TEXTAREA:
          typeInfo = 'Long text answer (2-5 sentences, detailed and thoughtful)';
          break;
        case QuestionType.MULTIPLE_CHOICE:
          typeInfo = `Choose ONE option from: ${q.options?.join(', ')}`;
          break;
        case QuestionType.CHECKBOX:
          typeInfo = `Choose one or more options from: ${q.options?.join(', ')}`;
          break;
        case QuestionType.DROPDOWN:
          typeInfo = `Choose ONE option from: ${q.options?.join(', ')}`;
          break;
        case QuestionType.EMAIL:
          typeInfo = 'Valid email address';
          break;
        case QuestionType.NUMBER:
          typeInfo = 'A number';
          break;
        case QuestionType.DATE:
          typeInfo = 'Date in YYYY-MM-DD format';
          break;
        case QuestionType.TIME:
          typeInfo = 'Time in HH:MM format';
          break;
        case QuestionType.RATING:
          typeInfo = 'Rating from 1 to 5';
          break;
        default:
          typeInfo = 'Text answer';
      }
      return `Question ${idx + 1} (ID: ${q.id}, Type: ${q.type}):
  Title: "${q.title}"
  ${q.description ? `Description: "${q.description}"` : ''}
  Expected format: ${typeInfo}
  Required: ${q.required ? 'Yes' : 'No'}`;
    })
    .join('\n\n');

  // Sentiment-based personas
  const positivePersonas = [
    'satisfied customer who had an excellent experience',
    'enthusiastic supporter who loves the product',
    'happy long-time user who recommends it to everyone',
    'impressed first-time user pleasantly surprised by quality',
    'loyal customer who appreciates the attention to detail',
  ];
  
  const negativePersonas = [
    'frustrated user who had multiple problems',
    'disappointed customer expecting much better',
    'unhappy user considering alternatives',
    'annoyed customer who encountered bugs and issues',
    'dissatisfied user who feels the product doesn\'t deliver on promises',
  ];
  
  const neutralPersonas = [
    'balanced reviewer giving objective feedback',
    'pragmatic user stating facts without strong emotions',
    'analytical person weighing pros and cons equally',
    'matter-of-fact professional giving straightforward answers',
    'impartial observer providing honest but neutral assessment',
  ];

  // Select persona based on sentiment
  let persona: string;
  let sentimentInstruction: string;
  
  switch (sentiment) {
    case 'positive':
      persona = positivePersonas[responseIndex % positivePersonas.length];
      sentimentInstruction = `
SENTIMENT: POSITIVE
- Express satisfaction, happiness, and appreciation
- Highlight what works well and positive experiences
- Use positive language and enthusiasm
- For ratings, prefer 4-5 stars
- Focus on benefits and strengths`;
      break;
    case 'negative':
      persona = negativePersonas[responseIndex % negativePersonas.length];
      sentimentInstruction = `
SENTIMENT: NEGATIVE
- Express frustration, disappointment, or dissatisfaction
- Highlight problems, issues, and areas needing improvement
- Use critical but realistic language (not abusive)
- For ratings, prefer 1-2 stars
- Focus on pain points and weaknesses`;
      break;
    case 'neutral':
    default:
      persona = neutralPersonas[responseIndex % neutralPersonas.length];
      sentimentInstruction = `
SENTIMENT: NEUTRAL
- Be balanced and objective in your responses
- Mention both positives and negatives if applicable
- Use matter-of-fact language without strong emotions
- For ratings, prefer 3 stars (can vary to 2-4)
- Focus on factual observations`;
      break;
  }

  const prompt = `You are simulating survey responses for testing purposes. Generate realistic, varied responses as if you were a ${persona}.
${sentimentInstruction}

Form Title: "${form.title}"
${form.description ? `Form Description: "${form.description}"` : ''}

Questions:
${questionPrompts}

Generate a complete set of responses for this survey. Be creative and realistic. Vary your tone and detail level.
For text/textarea questions, provide thoughtful, realistic answers that a real person might write.
For multiple choice/dropdown, choose from the provided options only.
For checkbox questions, you may select multiple options - return them as a JSON array.
For ratings, use numbers 1-5.

IMPORTANT: Return ONLY a valid JSON object with question IDs as keys and answers as values.
For checkbox questions, the value should be an array of strings.
For rating questions, the value should be a number 1-5.
For all other questions, the value should be a string.

Example format:
{
  "q1_abc123": "My text answer here",
  "q2_def456": ["Option A", "Option C"],
  "q3_ghi789": 4
}

Generate response ${responseIndex + 1} of ${totalResponses}:`;

  try {
    const result = await llm.invoke(prompt);
    const content = result.content.toString();
    
    // Extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('Failed to extract JSON from LLM response:', content);
      return generateFallbackResponse(form);
    }

    const parsed = JSON.parse(jsonMatch[0]);
    
    // Convert to Answer array
    const answers: Answer[] = form.questions.map((q) => ({
      questionId: q.id,
      value: parsed[q.id] !== undefined ? parsed[q.id] : generateFallbackValue(q),
    }));

    return answers;
  } catch (error) {
    console.error('Error generating response with LLM:', error);
    return generateFallbackResponse(form);
  }
}

// Fallback response generator (no LLM)
function generateFallbackResponse(form: Form): Answer[] {
  return form.questions.map((q) => ({
    questionId: q.id,
    value: generateFallbackValue(q),
  }));
}

function generateFallbackValue(question: Question): any {
  const randomTexts = [
    'This is a sample response for testing purposes.',
    'I think this could be improved in several ways.',
    'Overall, I had a positive experience.',
    'There are some areas that need attention.',
    'The service was excellent and exceeded expectations.',
  ];

  switch (question.type) {
    case QuestionType.TEXT:
      return randomTexts[Math.floor(Math.random() * randomTexts.length)];
    case QuestionType.TEXTAREA:
      return randomTexts.slice(0, 2 + Math.floor(Math.random() * 3)).join(' ');
    case QuestionType.MULTIPLE_CHOICE:
    case QuestionType.DROPDOWN:
      if (question.canBeOther && Math.random() < 0.25) {
        return { other: `Custom option for ${question.title}` };
      }
      if (question.options && question.options.length > 0) {
        return question.options[Math.floor(Math.random() * question.options.length)];
      }
      return 'Option A';
    case QuestionType.CHECKBOX:
      if (question.canBeOther && Math.random() < 0.25) {
        return { other: `Custom check for ${question.title}` };
      }
      if (question.options && question.options.length > 0) {
        const count = 1 + Math.floor(Math.random() * Math.min(3, question.options.length));
        const shuffled = [...question.options].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, count);
      }
      return ['Option A'];
    case QuestionType.EMAIL:
      return `user${Math.floor(Math.random() * 1000)}@example.com`;
    case QuestionType.NUMBER:
      return Math.floor(Math.random() * 100);
    case QuestionType.DATE:
      const date = new Date();
      date.setDate(date.getDate() - Math.floor(Math.random() * 365));
      return date.toISOString().split('T')[0];
    case QuestionType.TIME:
      const hours = Math.floor(Math.random() * 24).toString().padStart(2, '0');
      const minutes = Math.floor(Math.random() * 60).toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    case QuestionType.RATING:
      return Math.floor(Math.random() * 5) + 1;
    default:
      return 'Sample answer';
  }
}

// Check if response has text content
function hasTextContent(answers: Answer[]): boolean {
  return answers.some((ans) => {
    const v = ans.value;
    if (typeof v === 'string' && v.trim().length > 0) return true;
    if (Array.isArray(v)) return v.some((i) => typeof i === 'string' && i.trim().length > 0);
    if (v && typeof v === 'object' && !Array.isArray(v) && 'other' in v) {
      return (v as { other: string }).other.trim().length > 0;
    }
    return false;
  });
}

// Parse command line arguments
function parseArgs(args: string[]): { formId: string; count: number; sentiment: SentimentConfig } {
  if (args.length < 1 || args[0].startsWith('-')) {
    console.error('Usage: npx ts-node scripts/generate-fake-responses.ts <formId> [options]');
    console.error('\nOptions:');
    console.error('  --count, -c <number>     Total number of responses (default: 10)');
    console.error('  --positive, -p <number>  Number of positive responses');
    console.error('  --negative, -n <number>  Number of negative responses');
    console.error('  --neutral, -u <number>   Number of neutral responses');
    console.error('\nExamples:');
    console.error('  # 10 responses with random sentiment');
    console.error('  npx ts-node scripts/generate-fake-responses.ts 693dd792c5a2184364445ae2');
    console.error('\n  # 50 responses with random sentiment');
    console.error('  npx ts-node scripts/generate-fake-responses.ts 693dd792c5a2184364445ae2 -c 50');
    console.error('\n  # Specific distribution: 20 positive, 10 negative, 5 neutral');
    console.error('  npx ts-node scripts/generate-fake-responses.ts 693dd792c5a2184364445ae2 -p 20 -n 10 -u 5');
    process.exit(1);
  }

  const formId = args[0];
  let count: number | null = null;
  let positive: number | null = null;
  let negative: number | null = null;
  let neutral: number | null = null;

  // Parse remaining arguments
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--count':
      case '-c':
        count = parseInt(nextArg, 10);
        i++;
        break;
      case '--positive':
      case '-p':
        positive = parseInt(nextArg, 10);
        i++;
        break;
      case '--negative':
      case '-n':
        negative = parseInt(nextArg, 10);
        i++;
        break;
      case '--neutral':
      case '-u':
        neutral = parseInt(nextArg, 10);
        i++;
        break;
      default:
        // Support legacy format: formId count
        if (!arg.startsWith('-') && i === 1) {
          count = parseInt(arg, 10);
        }
    }
  }

  // Determine final sentiment distribution
  const hasSentimentArgs = positive !== null || negative !== null || neutral !== null;
  
  let sentimentConfig: SentimentConfig;
  
  if (hasSentimentArgs) {
    // Use specified sentiment values
    sentimentConfig = {
      positive: positive ?? 0,
      negative: negative ?? 0,
      neutral: neutral ?? 0,
    };
    
    const sentimentTotal = sentimentConfig.positive + sentimentConfig.negative + sentimentConfig.neutral;
    
    // If count is also specified and larger, fill remaining with neutral
    if (count !== null && count > sentimentTotal) {
      sentimentConfig.neutral += count - sentimentTotal;
    }
    
    // If no count specified, use sentiment total
    if (count === null) {
      count = sentimentTotal;
    }
  } else {
    // Random distribution based on count
    const totalCount = count ?? 10;
    count = totalCount;
    
    // Default distribution: ~40% positive, ~30% neutral, ~30% negative
    const positiveCount = Math.floor(totalCount * 0.4);
    const negativeCount = Math.floor(totalCount * 0.3);
    const neutralCount = totalCount - positiveCount - negativeCount;
    
    sentimentConfig = {
      positive: positiveCount,
      negative: negativeCount,
      neutral: neutralCount,
    };
  }

  // Validate
  if (isNaN(count) || count < 1) {
    console.error('❌ Count must be a positive number');
    process.exit(1);
  }

  if (sentimentConfig.positive < 0 || sentimentConfig.negative < 0 || sentimentConfig.neutral < 0) {
    console.error('❌ Sentiment counts cannot be negative');
    process.exit(1);
  }

  const totalSentiment = sentimentConfig.positive + sentimentConfig.negative + sentimentConfig.neutral;
  if (totalSentiment === 0) {
    console.error('❌ At least one sentiment type must have a positive count');
    process.exit(1);
  }

  return { formId, count: totalSentiment, sentiment: sentimentConfig };
}

// Build sentiment queue for responses
function buildSentimentQueue(config: SentimentConfig): SentimentType[] {
  const queue: SentimentType[] = [];
  
  for (let i = 0; i < config.positive; i++) queue.push('positive');
  for (let i = 0; i < config.negative; i++) queue.push('negative');
  for (let i = 0; i < config.neutral; i++) queue.push('neutral');
  
  // Shuffle the queue for variety
  for (let i = queue.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [queue[i], queue[j]] = [queue[j], queue[i]];
  }
  
  return queue;
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const { formId, count, sentiment } = parseArgs(args);

  console.log(`\n🚀 Generating ${count} fake responses for form: ${formId}`);
  console.log(`   📊 Sentiment distribution:`);
  console.log(`      ✅ Positive: ${sentiment.positive}`);
  console.log(`      ❌ Negative: ${sentiment.negative}`);
  console.log(`      ➖ Neutral:  ${sentiment.neutral}\n`);

  // Connect to MongoDB
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/formulai';
  console.log(`📦 Connecting to MongoDB: ${mongoUri.replace(/\/\/[^:]+:[^@]+@/, '//*****:*****@')}`);
  
  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB\n');

  // Create models
  const FormModel = mongoose.model('Form', FormSchema);
  const ResponseModel = mongoose.model('Response', ResponseSchema);

  // Fetch the form
  let form: Form | null;
  try {
    form = await FormModel.findById(formId).lean() as Form | null;
  } catch (error) {
    console.error(`❌ Invalid form ID format: ${formId}`);
    await mongoose.disconnect();
    process.exit(1);
  }

  if (!form) {
    console.error(`❌ Form not found: ${formId}`);
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`📋 Form: "${form.title}"`);
  console.log(`   Questions: ${form.questions.length}`);
  console.log(`   Description: ${form.description || 'N/A'}\n`);

  // Initialize LLM
  let llm: any;
  try {
    llm = initializeLLM();
    console.log(`🤖 LLM initialized (OpenAI: ${process.env.OPENAI_MODEL || 'gpt-4o-mini'})\n`);
  } catch (error) {
    console.error('⚠️  LLM initialization failed, using fallback generator');
    console.error(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
    llm = null;
  }

  // Generate responses
  const responses: ResponseDoc[] = [];
  const batchSize = 5; // Process in batches to avoid rate limits
  const sentimentQueue = buildSentimentQueue(sentiment);
  
  // Track sentiment counts for logging
  const generatedCounts = { positive: 0, negative: 0, neutral: 0 };
  
  for (let i = 0; i < count; i++) {
    const currentSentiment = sentimentQueue[i];
    const sentimentEmoji = currentSentiment === 'positive' ? '✅' : currentSentiment === 'negative' ? '❌' : '➖';
    process.stdout.write(`\r⏳ Generating response ${i + 1}/${count} (${sentimentEmoji} ${currentSentiment})...      `);
    
    let answers: Answer[];
    if (llm) {
      answers = await generateSingleResponse(llm, form, i, count, currentSentiment);
      // Small delay to avoid rate limits
      if ((i + 1) % batchSize === 0 && i < count - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } else {
      answers = form.questions.map((question) => {
        const value = generateFallbackValue(question);
        const answer: any = {
          questionId: question.id,
          value,
        };

        // Normalize "Other" answers
        if (value && typeof value === 'object' && !Array.isArray(value) && 'other' in value) {
          answer.metadata = {
            normalizedValue: (value as { other: string }).other,
          };
        }

        return answer;
      });
    }

    generatedCounts[currentSentiment]++;

    const response: ResponseDoc = {
      formId: new Types.ObjectId(formId),
      answers,
      submittedAt: new Date(Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000)), // Random date within last 30 days
      metadata: {
        hasTextContent: hasTextContent(answers),
        processedForAnalytics: false,
        extractedKeywords: [],
      },
    };

    responses.push(response);
  }

  console.log('\n\n💾 Saving responses to database...');

  // Insert all responses
  const inserted = await ResponseModel.insertMany(responses);
  
  console.log(`✅ Successfully created ${inserted.length} responses`);
  console.log(`   📊 Generated: ✅ ${generatedCounts.positive} positive | ❌ ${generatedCounts.negative} negative | ➖ ${generatedCounts.neutral} neutral\n`);

  // Show sample response
  if (inserted.length > 0) {
    console.log('📝 Sample response:');
    const sample = responses[0];
    sample.answers.slice(0, 3).forEach((answer) => {
      const question = form!.questions.find((q) => q.id === answer.questionId);
      console.log(`   Q: "${question?.title || answer.questionId}"`);
      console.log(`   A: ${JSON.stringify(answer.value).slice(0, 100)}${JSON.stringify(answer.value).length > 100 ? '...' : ''}`);
      console.log('');
    });
    if (sample.answers.length > 3) {
      console.log(`   ... and ${sample.answers.length - 3} more answers\n`);
    }
  }

  // Disconnect
  await mongoose.disconnect();
  console.log('👋 Done! Disconnected from MongoDB');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  mongoose.disconnect();
  process.exit(1);
});
