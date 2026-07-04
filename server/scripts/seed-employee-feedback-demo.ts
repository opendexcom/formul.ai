/**
 * Seed an employee feedback A/B study for test@test.pl:
 * - 2 variants (main + A) with split-questionnaire design
 * - One polarity-flipped rating question in variant A
 * - 14 responses per variant with aligned positive text answers
 * - Same high raw ratings on the flipped question → low cross-variant agreement
 *
 * Usage:
 *   pnpm exec ts-node scripts/seed-employee-feedback-demo.ts
 *   pnpm exec ts-node scripts/seed-employee-feedback-demo.ts --email other@example.com
 */

import mongoose, { Types } from 'mongoose';
import * as dotenv from 'dotenv';

dotenv.config();

const TARGET_EMAIL = process.argv.includes('--email')
  ? process.argv[process.argv.indexOf('--email') + 1]
  : 'test@test.pl';

const RESPONSES_PER_VARIANT = 14;

const QUESTION_IDS = {
  appreciate: 'question_ef_appreciate',
  workload: 'question_ef_workload',
  satisfaction: 'question_ef_satisfaction',
  recommend: 'question_ef_recommend',
  improve: 'question_ef_improve',
} as const;

const POSITIVE_APPRECIATE = [
  'Great team culture and supportive managers who listen to feedback.',
  'Flexible working hours and trust in remote work make a real difference.',
  'Clear career paths and regular learning opportunities.',
  'Collaborative atmosphere — people genuinely help each other.',
  'Good work-life balance compared to my previous employer.',
  'Transparent leadership and open communication from the top.',
  'Interesting projects that keep me engaged and growing.',
  'Benefits package is competitive and well communicated.',
  'Inclusive environment where diverse perspectives are valued.',
  'Recognition programs make hard work feel appreciated.',
  'Stable company with a strong mission I believe in.',
  'Modern tools and efficient processes reduce daily friction.',
  'Mentorship from senior colleagues has accelerated my growth.',
  'Office amenities and wellbeing initiatives show the company cares.',
];

const POSITIVE_IMPROVE = [
  'Maybe more cross-team social events would be nice, but overall very happy.',
  'Occasional meeting overload — otherwise excellent place to work.',
  'Would love slightly faster approval cycles on small purchases.',
  'Documentation could be updated more often, nothing major.',
  'More quiet focus rooms would help, but culture is already strong.',
  'Annual review process could be shorter — satisfaction is still high.',
  'Minor tweaks to the intranet search, otherwise no complaints.',
  'More optional training slots during busy periods would help.',
  'Parking is tight some days — small issue in an otherwise great workplace.',
  'Slack channels multiply quickly; a cleanup guide would help.',
  'Onboarding for new tools could be smoother, team support makes up for it.',
  'Coffee variety in the kitchen — joking, everything else is great.',
  'Would appreciate clearer OKR examples at quarter start.',
  'Nothing urgent — keep doing what you are doing.',
];

function buildQuestions(variant: 'main' | 'A') {
  const isVariantA = variant === 'A';
  return [
    {
      id: QUESTION_IDS.appreciate,
      title: 'What do you appreciate most about working here?',
      type: 'textarea',
      required: true,
      order: 0,
    },
    {
      id: QUESTION_IDS.workload,
      title: 'I feel my workload is manageable',
      description: '1 = Strongly disagree, 5 = Strongly agree',
      type: 'rating',
      required: true,
      order: 1,
    },
    {
      id: QUESTION_IDS.satisfaction,
      title: isVariantA
        ? 'I am NOT satisfied with my job overall'
        : 'I am satisfied with my job overall',
      description: isVariantA
        ? '1 = Strongly disagree, 5 = Strongly agree (reverse-coded opposite of main)'
        : '1 = Strongly disagree, 5 = Strongly agree',
      type: 'rating',
      required: true,
      order: 2,
      reverseCoded: isVariantA,
    },
    {
      id: QUESTION_IDS.recommend,
      title: 'Would you recommend this company as a place to work?',
      type: 'multiple_choice',
      required: true,
      order: 3,
      options: ['Strongly agree', 'Agree', 'Neutral', 'Disagree', 'Strongly disagree'],
    },
    {
      id: QUESTION_IDS.improve,
      title: 'What could we improve? (optional concerns welcome)',
      type: 'textarea',
      required: false,
      order: 4,
    },
  ];
}

function reverseCodedSatisfaction(mainRating: number): number {
  // Positive on main (4–5) → disagree with "NOT satisfied" on variant A (2–3)
  if (mainRating === 4) return 2;
  if (mainRating === 5) return 3;
  return Math.max(1, Math.min(5, 6 - mainRating));
}

function buildAnswers(index: number, variantKey: 'main' | 'A') {
  const rating = index % 5 === 0 ? 4 : 5;
  const recommend = index % 3 === 0 ? 'Agree' : 'Strongly agree';
  const satisfactionRating =
    variantKey === 'A' ? reverseCodedSatisfaction(rating) : rating;

  return [
    { questionId: QUESTION_IDS.appreciate, value: POSITIVE_APPRECIATE[index] },
    { questionId: QUESTION_IDS.workload, value: rating },
    {
      questionId: QUESTION_IDS.satisfaction,
      value: satisfactionRating,
    },
    { questionId: QUESTION_IDS.recommend, value: recommend },
    { questionId: QUESTION_IDS.improve, value: POSITIVE_IMPROVE[index] },
  ];
}

async function main() {
  const mongoUri =
    process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/formulai';

  console.log(`\nSeeding employee feedback demo for ${TARGET_EMAIL}`);
  await mongoose.connect(mongoUri);

  const User = mongoose.model('User', new mongoose.Schema({ email: String }));
  const Form = mongoose.model(
    'Form',
    new mongoose.Schema({
      title: String,
      description: String,
      createdBy: mongoose.Schema.Types.ObjectId,
      projectId: mongoose.Schema.Types.ObjectId,
      variantKey: String,
      questions: [Object],
      isActive: Boolean,
      isPublic: Boolean,
      settings: Object,
    }),
  );
  const Project = mongoose.model(
    'Project',
    new mongoose.Schema({
      name: String,
      hypothesis: String,
      hypotheses: [String],
      ownerId: mongoose.Schema.Types.ObjectId,
      type: String,
      researchDesignType: String,
      splitQuestionnaireDesign: Object,
      status: String,
      variants: [Object],
    }),
  );
  const Response = mongoose.model(
    'Response',
    new mongoose.Schema({
      formId: mongoose.Schema.Types.ObjectId,
      answers: [{ questionId: String, value: mongoose.Schema.Types.Mixed }],
      submittedAt: Date,
      metadata: Object,
    }),
  );

  const user = await User.findOne({ email: TARGET_EMAIL });
  if (!user) {
    console.error(`User not found: ${TARGET_EMAIL}`);
    process.exit(1);
  }

  const ownerId = user._id as Types.ObjectId;
  const projectId = new Types.ObjectId();
  const mainFormId = new Types.ObjectId();
  const variantAFormId = new Types.ObjectId();

  const title = 'Employee Feedback Survey';
  const description =
    'Annual pulse survey measuring employee satisfaction, workload, and recommendation intent.';

  const coreQuestionIds = Object.values(QUESTION_IDS);
  const flippedId = QUESTION_IDS.satisfaction;

  await Form.create({
    _id: mainFormId,
    title,
    description,
    createdBy: ownerId,
    projectId,
    variantKey: 'main',
    questions: buildQuestions('main'),
    isActive: true,
    isPublic: true,
    settings: {
      allowMultipleResponses: true,
      requireLogin: false,
      showProgressBar: true,
    },
  });

  await Form.create({
    _id: variantAFormId,
    title: `${title} (A)`,
    description,
    createdBy: ownerId,
    projectId,
    variantKey: 'A',
    questions: buildQuestions('A'),
    isActive: true,
    isPublic: true,
    settings: {
      allowMultipleResponses: true,
      requireLogin: false,
      showProgressBar: true,
    },
  });

  await Project.create({
    _id: projectId,
    name: title,
    hypothesis:
      'Employees report high overall satisfaction and manageable workload across both survey branches.',
    hypotheses: [
      'Employees report high overall satisfaction and manageable workload across both survey branches.',
    ],
    ownerId,
    type: 'ab_test',
    researchDesignType: 'split_questionnaire',
    splitQuestionnaireDesign: {
      coreQuestionIds,
      perVariant: {
        A: {
          modifiedQuestionIds: [],
          excludedQuestionIds: [],
          polarityFlippedQuestionIds: [flippedId],
        },
      },
    },
    status: 'collecting',
    variants: [
      {
        key: 'main',
        formId: mainFormId,
        targetGroup: { name: 'Branch Main — standard wording' },
        publishedAt: new Date(),
      },
      {
        key: 'A',
        formId: variantAFormId,
        targetGroup: { name: 'Branch A — satisfaction item reverse-coded' },
        publishedAt: new Date(),
      },
    ],
  });

  const now = Date.now();
  const responses: Array<Record<string, unknown>> = [];

  for (let i = 0; i < RESPONSES_PER_VARIANT; i++) {
    const submittedAt = new Date(now - (RESPONSES_PER_VARIANT - i) * 3600_000);
    for (const [formId, variantKey] of [
      [mainFormId, 'main'],
      [variantAFormId, 'A'],
    ] as const) {
      const answers = buildAnswers(i, variantKey);
      responses.push({
        formId,
        answers,
        submittedAt,
        metadata: {
          hasTextContent: true,
          processedForAnalytics: false,
          extractedKeywords: [],
        },
      });
    }
  }

  await Response.insertMany(responses);

  console.log('\nCreated:');
  console.log(`  Project ID:  ${projectId.toString()}`);
  console.log(`  Main form:   ${mainFormId.toString()} (variant main)`);
  console.log(`  Variant A:   ${variantAFormId.toString()} (reverse-coded: "${flippedId}")`);
  console.log(`  Responses:   ${RESPONSES_PER_VARIANT} per variant (${responses.length} total)`);
  console.log('\nDesign note:');
  console.log('  Main branch: satisfaction 4–5 with positive text.');
  console.log('  Variant A (reverse-coded "NOT satisfied"): satisfaction 2–3 with the same positive text.');
  console.log('  Cross-branch comparison should align after reverse-coding normalization.');
  console.log(`\nOpen: /projects/${projectId.toString()}\n`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  mongoose.disconnect();
  process.exit(1);
});
