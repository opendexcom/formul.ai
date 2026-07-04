import 'dotenv/config';
import mongoose, { Schema, Types } from 'mongoose';

const dryRun = process.argv.includes('--dry-run');
const mongoUri =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/formulai';

const FormSchema = new Schema(
  {
    title: String,
    description: String,
    createdBy: { type: Schema.Types.ObjectId, required: true },
    isActive: { type: Boolean, default: true },
    analytics: { type: Object },
    projectId: { type: Schema.Types.ObjectId },
    variantKey: { type: String },
  },
  { timestamps: true, collection: 'forms' },
);

const ProjectSchema = new Schema(
  {
    name: String,
    hypothesis: String,
    ownerId: { type: Schema.Types.ObjectId, required: true },
    type: String,
    status: String,
    variants: [
      {
        key: String,
        formId: Schema.Types.ObjectId,
        targetGroup: { name: String, description: String },
      },
    ],
    publishedAt: Date,
    migratedFromFormId: Schema.Types.ObjectId,
  },
  { timestamps: true, collection: 'projects' },
);

const ResponseSchema = new Schema(
  {
    formId: Schema.Types.ObjectId,
  },
  { collection: 'responses' },
);

function deriveStatus(isActive: boolean, responseCount: number, analytics: unknown) {
  if (!isActive && responseCount === 0) return 'designing';
  if (!isActive && responseCount > 0) return 'collecting';
  if (isActive && responseCount === 0) return 'published';
  if ((analytics as any)?.lastUpdated) return 'analyzed';
  return 'collecting';
}

async function main() {
  await mongoose.connect(mongoUri);
  const FormModel = mongoose.model('FormMigrationForm', FormSchema);
  const ProjectModel = mongoose.model('FormMigrationProject', ProjectSchema);
  const ResponseModel = mongoose.model('FormMigrationResponse', ResponseSchema);

  const forms = await FormModel.find({
    $or: [{ projectId: { $exists: false } }, { projectId: null }],
  });
  let migrated = 0;
  let skipped = 0;

  for (const form of forms) {
    const existingProject = await ProjectModel.findOne({
      migratedFromFormId: form._id,
    });
    if (existingProject) {
      skipped += 1;
      if (!dryRun) {
        await FormModel.updateOne(
          { _id: form._id },
          { $set: { projectId: existingProject._id, variantKey: 'main' } },
        );
      }
      continue;
    }

    const responseCount = await ResponseModel.countDocuments({ formId: form._id });
    const status = deriveStatus(form.isActive, responseCount, form.analytics);
    const projectId = new Types.ObjectId();

    if (!dryRun) {
      await ProjectModel.create({
        _id: projectId,
        name: form.title || 'Untitled project',
        hypothesis: form.description || '',
        ownerId: form.createdBy,
        type: 'single',
        status,
        variants: [
          {
            key: 'main',
            formId: form._id,
            targetGroup: { name: 'General' },
          },
        ],
        publishedAt: form.isActive ? form.updatedAt || form.createdAt : undefined,
        migratedFromFormId: form._id,
        createdAt: form.createdAt,
        updatedAt: form.updatedAt,
      });
      await FormModel.updateOne(
        { _id: form._id },
        { $set: { projectId, variantKey: 'main' } },
      );
    }

    migrated += 1;
  }

  const remaining = await FormModel.countDocuments({
    $or: [{ projectId: { $exists: false } }, { projectId: null }],
  });

  console.log(
    JSON.stringify(
      {
        dryRun,
        scanned: forms.length,
        migrated,
        skipped,
        remainingWithoutProjectId: remaining,
      },
      null,
      2,
    ),
  );

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
