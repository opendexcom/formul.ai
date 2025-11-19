import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Form, FormDocument } from '../schemas/form.schema';

@Injectable()
export class MigrationService {
  constructor(
    @InjectModel(Form.name) private formModel: Model<FormDocument>,
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
}