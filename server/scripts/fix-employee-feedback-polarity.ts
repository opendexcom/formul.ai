/**
 * Fix the test@test.pl Employee Feedback project:
 * - Mark variant A satisfaction question as reverse-coded (opposite polarity)
 * - Set split-questionnaire design on the project
 * - Seed 14 variant-A responses with reverse-coded satisfaction (2–3 when main is 4–5)
 *
 * Usage:
 *   pnpm exec ts-node scripts/fix-employee-feedback-polarity.ts
 */

import mongoose, { Types } from 'mongoose';
import * as dotenv from 'dotenv';

dotenv.config();

const PROJECT_ID = '6a4172e12886543abcca0e71';
const MAIN_FORM_ID = '695e3c3d643c5a120d5513b5';
const VARIANT_A_FORM_ID = '6a421f14e63a2ad9591fa265';
const FLIPPED_QUESTION_ID = 'q3';

function reverseCodedSatisfaction(mainRating: number): number {
  if (mainRating === 4) return 2;
  if (mainRating === 5) return 3;
  if (typeof mainRating === 'number') return Math.max(1, Math.min(5, 6 - mainRating));
  return mainRating;
}

function flipAnswersForVariantA(
  answers: Array<{ questionId: string; value: unknown }>,
): Array<{ questionId: string; value: unknown }> {
  return answers.map((a) => {
    if (a.questionId !== FLIPPED_QUESTION_ID) return a;
    if (typeof a.value !== 'number') return a;
    return { ...a, value: reverseCodedSatisfaction(a.value) };
  });
}

async function main() {
  const mongoUri =
    process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/formulai';

  await mongoose.connect(mongoUri);

  const Form = mongoose.model('Form', new mongoose.Schema({}, { strict: false }));
  const Project = mongoose.model('Project', new mongoose.Schema({}, { strict: false }));
  const Response = mongoose.model('Response', new mongoose.Schema({}, { strict: false }));

  const mainForm = (await Form.findById(MAIN_FORM_ID).lean()) as {
    questions?: Array<{ id: string }>;
  } | null;
  if (!mainForm) throw new Error('Main form not found');

  const coreQuestionIds = (mainForm.questions ?? []).map((q) => q.id);

  const variantAForm = await Form.findById(VARIANT_A_FORM_ID);
  if (!variantAForm) throw new Error('Variant A form not found');

  const doc = variantAForm as typeof variantAForm & {
    questions: Array<Record<string, unknown>>;
  };
  const questions = doc.questions ?? [];
  doc.questions = questions.map((q) => {
    if (q.id !== FLIPPED_QUESTION_ID) return q;
    return {
      ...q,
      title: 'I am NOT satisfied with my job overall',
      description: '1 = Strongly disagree, 5 = Strongly agree (reverse-coded opposite of main)',
      reverseCoded: true,
    };
  });
  await doc.save();

  await Project.findByIdAndUpdate(PROJECT_ID, {
    $set: {
      researchDesignType: 'split_questionnaire',
      splitQuestionnaireDesign: {
        coreQuestionIds,
        perVariant: {
          A: {
            modifiedQuestionIds: [FLIPPED_QUESTION_ID],
            excludedQuestionIds: [],
            polarityFlippedQuestionIds: [FLIPPED_QUESTION_ID],
          },
        },
      },
    },
  });

  const mainFormOid = new Types.ObjectId(MAIN_FORM_ID);
  const variantAFormOid = new Types.ObjectId(VARIANT_A_FORM_ID);

  await Response.deleteMany({ formId: variantAFormOid });

  const mainResponses = (await Response.find({ formId: mainFormOid })
    .sort({ submittedAt: 1 })
    .lean()) as unknown as Array<{
    answers: unknown[];
    submittedAt?: Date;
    metadata?: Record<string, unknown>;
  }>;

  const variantResponses = mainResponses.map((r, index) => ({
    formId: variantAFormOid,
    answers: flipAnswersForVariantA(
      r.answers as Array<{ questionId: string; value: unknown }>,
    ),
    submittedAt: r.submittedAt ?? new Date(Date.now() - (mainResponses.length - index) * 3600_000),
    metadata: r.metadata ?? {
      hasTextContent: true,
      processedForAnalytics: false,
      extractedKeywords: [],
    },
  }));

  if (variantResponses.length > 0) {
    await Response.insertMany(variantResponses);
  }

  const flipped = (doc.questions as Array<{ id: string; title: string; reverseCoded?: boolean }>).find(
    (q) => q.id === FLIPPED_QUESTION_ID,
  );

  console.log('\nFixed Employee Feedback Survey project');
  console.log(`  Project:     ${PROJECT_ID}`);
  console.log(`  Variant A:   ${VARIANT_A_FORM_ID}`);
  console.log(`  Flipped Q:   "${flipped?.title}" (reverseCoded: ${flipped?.reverseCoded})`);
  console.log(`  Responses:   ${variantResponses.length} on variant A`);
  console.log('\nOpen variant A editor to see "Polarity flip" badge and Reverse coded checkbox on q3.');
  console.log(`  /projects/${PROJECT_ID}/variants/A/edit\n`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  mongoose.disconnect();
  process.exit(1);
});
