import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Form, FormDocument } from '../schemas/form.schema';
import { Project, ProjectDocument, ProjectStatus } from '../schemas/project.schema';
import { Response, ResponseDocument } from '../schemas/response.schema';

@Injectable()
export class MigrationService {
  constructor(
    @InjectModel(Form.name) private formModel: Model<FormDocument>,
    @InjectModel(Project.name) private projectModel: Model<ProjectDocument>,
    @InjectModel(Response.name) private responseModel: Model<ResponseDocument>,
  ) {}

  /**
   * Fix forms where createdBy is a populated user object instead of ObjectId
   */
  async fixFormCreatedByFields(): Promise<void> {
    console.log('Starting migration to fix createdBy fields...');

    // Find all forms where createdBy is an object (populated) instead of ObjectId
    const formsWithPopulatedCreatedBy = await this.formModel
      .find({
        'createdBy._id': { $exists: true }
      })
      .exec();

    console.log(`Found ${formsWithPopulatedCreatedBy.length} forms with populated createdBy fields`);

    let fixedCount = 0;
    for (const form of formsWithPopulatedCreatedBy) {
      try {
        // Extract the ObjectId from the populated user object
        const userId = (form.createdBy as any)._id;
        
        // Update the form to store only the ObjectId
        await this.formModel.updateOne(
          { _id: form._id },
          { 
            $set: { 
              createdBy: new Types.ObjectId(userId),
              updatedAt: new Date()
            } 
          }
        );
        
        fixedCount++;
        console.log(`Fixed form: ${form._id} - createdBy: ${userId}`);
      } catch (error) {
        console.error(`Error fixing form ${form._id}:`, error);
      }
    }

    console.log(`Migration completed. Fixed ${fixedCount} forms.`);
  }

  /**
   * Validate that all forms have proper ObjectId references for createdBy
   */
  async validateFormCreatedByFields(): Promise<void> {
    console.log('Validating form createdBy fields...');

    const totalForms = await this.formModel.countDocuments();
    const formsWithObjectIdCreatedBy = await this.formModel.countDocuments({
      createdBy: { $type: 'objectId' }
    });
    const formsWithPopulatedCreatedBy = await this.formModel.countDocuments({
      'createdBy._id': { $exists: true }
    });

    console.log(`Total forms: ${totalForms}`);
    console.log(`Forms with ObjectId createdBy: ${formsWithObjectIdCreatedBy}`);
    console.log(`Forms with populated createdBy: ${formsWithPopulatedCreatedBy}`);

    if (formsWithPopulatedCreatedBy > 0) {
      console.log('⚠️  Found forms with incorrect createdBy structure. Run fixFormCreatedByFields() to fix them.');
    } else {
      console.log('✅ All forms have correct createdBy structure.');
    }
  }

  /**
   * Show detailed information about forms with incorrect structure
   */
  async showProblematicForms(): Promise<void> {
    console.log('Showing forms with problematic createdBy structure...');

    const problematicForms = await this.formModel
      .find({
        'createdBy._id': { $exists: true }
      })
      .select('_id title createdBy createdAt')
      .exec();

    console.log(`Found ${problematicForms.length} problematic forms:`);
    
    problematicForms.forEach((form, index) => {
      console.log(`${index + 1}. Form ID: ${form._id}`);
      console.log(`   Title: ${form.title}`);
      console.log(`   CreatedBy: ${JSON.stringify(form.createdBy)}`);
      console.log(`   CreatedAt: ${form.createdAt}`);
      console.log('---');
    });
  }

  private deriveStatus(form: FormDocument, responseCount: number): ProjectStatus {
    if (!form.isActive && responseCount === 0) return 'designing';
    if (!form.isActive && responseCount > 0) return 'collecting';
    if (form.isActive && responseCount === 0) return 'published';
    if (form.analytics?.lastUpdated) return 'analyzed';
    return 'collecting';
  }

  async migrateFormsToProjects(dryRun: boolean = false): Promise<{
    scanned: number;
    migrated: number;
    skipped: number;
  }> {
    const forms = await this.formModel.find({ projectId: { $exists: false } }).exec();

    let migrated = 0;
    let skipped = 0;
    for (const form of forms) {
      const existingProject = await this.projectModel.findOne({
        migratedFromFormId: form._id,
      });

      if (existingProject) {
        skipped += 1;
        if (!dryRun) {
          await this.formModel.updateOne(
            { _id: form._id },
            { $set: { projectId: existingProject._id, variantKey: 'main' } },
          );
        }
        continue;
      }

      const responseCount = await this.responseModel.countDocuments({ formId: form._id });
      const status = this.deriveStatus(form, responseCount);
      const projectId = new Types.ObjectId();

      if (!dryRun) {
        await this.projectModel.create({
          _id: projectId,
          name: form.title,
          hypothesis: form.description ?? '',
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
          publishedAt: form.isActive ? form.updatedAt ?? form.createdAt : undefined,
          migratedFromFormId: form._id,
          createdAt: form.createdAt,
          updatedAt: form.updatedAt,
        });

        await this.formModel.updateOne(
          { _id: form._id },
          { $set: { projectId, variantKey: 'main' } },
        );
      }

      migrated += 1;
    }

    return { scanned: forms.length, migrated, skipped };
  }
}