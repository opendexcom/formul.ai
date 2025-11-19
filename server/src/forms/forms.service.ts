import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Form, FormDocument } from '../schemas/form.schema';
import { CreateFormDto, UpdateFormDto } from './dto/form.dto';
import { ResponseService } from './response.service';

@Injectable()
export class FormsService {
  constructor(
    @InjectModel(Form.name) private formModel: Model<FormDocument>,
    private responseService: ResponseService,
  ) {}

  async create(createFormDto: CreateFormDto, userId: string): Promise<Form> {
    const form = new this.formModel({
      ...createFormDto,
      createdBy: new Types.ObjectId(userId),
      settings: {
        allowMultipleResponses: true,
        requireLogin: false,
        showProgressBar: true,
        ...createFormDto.settings,
      },
    });

    return form.save();
  }

  async findAllByUser(userId: string): Promise<Form[]> {
    console.log('Finding forms for user:', userId);
    
    const query = { createdBy: new Types.ObjectId(userId) };
    console.log('Query:', query);
    
    const forms = await this.formModel
      .find(query)
      .sort({ createdAt: -1 })
      .exec();
    
    console.log('Found', forms.length, 'forms for user:', userId);
    
    return forms;
  }

  async findOne(id: string, userId?: string): Promise<Form> {
    const form = await this.formModel.findById(id).populate('createdBy', 'firstName lastName email').exec();
    
    if (!form) {
      throw new NotFoundException('Form not found');
    }

    // If userId is provided, check if user owns the form or if form is public
    if (userId) {
      // Handle both populated and non-populated createdBy field
      const formOwnerId = typeof form.createdBy === 'object' && form.createdBy._id 
        ? form.createdBy._id.toString() 
        : form.createdBy.toString();
      const requestUserId = userId.toString();
      
      console.log('FindOne access check - Form ID:', id, 'Form Owner:', formOwnerId, 'Request User:', requestUserId, 'Is Public:', form.isPublic);
      
      if (formOwnerId !== requestUserId && !form.isPublic) {
        throw new ForbiddenException(`Access denied. Form owner: ${formOwnerId}, Request user: ${requestUserId}`);
      }
    }

    return form;
  }

  async update(id: string, updateFormDto: UpdateFormDto, userId: string): Promise<Form> {
    console.log('UPDATE FORM - Form ID:', id, 'User ID:', userId);
    console.log('UPDATE FORM - Update data:', JSON.stringify(updateFormDto, null, 2));
    
    const form = await this.formModel.findById(id);
    
    if (!form) {
      throw new NotFoundException('Form not found');
    }

    const formOwnerId = form.createdBy.toString();
    const requestUserId = userId.toString();

    console.log('UPDATE FORM - Form owner:', formOwnerId, 'Request user:', requestUserId);

    if (formOwnerId !== requestUserId) {
      throw new ForbiddenException(`Access denied. Form owner: ${formOwnerId}, Request user: ${requestUserId}`);
    }

    // Explicitly exclude system fields that should NEVER be updated
    const { _id, createdBy, createdAt, updatedAt, __v, ...safeUpdateData } = updateFormDto as any;
    
    console.log('UPDATE FORM - Safe update data:', JSON.stringify(safeUpdateData, null, 2));
    
    // The destructuring above already removes createdBy, so no need for additional check
    Object.assign(form, safeUpdateData);
    form.updatedAt = new Date();
    
    console.log('UPDATE FORM - About to save form');
    return form.save();
  }

  async remove(id: string, userId: string): Promise<void> {
    const form = await this.formModel.findById(id);
    
    if (!form) {
      throw new NotFoundException('Form not found');
    }

    const formOwnerId = form.createdBy.toString();
    const requestUserId = userId.toString();

    if (formOwnerId !== requestUserId) {
      throw new ForbiddenException('Access denied');
    }

    await this.formModel.findByIdAndDelete(id);
  }

  async getDebugCounts(userId: string): Promise<any> {
    const totalForms = await this.formModel.countDocuments();
    const userForms = await this.formModel.countDocuments({ createdBy: new Types.ObjectId(userId) });
    const allUserForms = await this.formModel.find({ createdBy: new Types.ObjectId(userId) }).select('_id title createdAt');
    
    return {
      totalFormsInDatabase: totalForms,
      userFormsCount: userForms,
      userId: userId,
      userFormsDetails: allUserForms,
    };
  }

  async getFormStats(id: string, userId: string): Promise<any> {
    const form = await this.findOne(id, userId);
    
    // Get response analytics from ResponseService
    const analytics = await this.responseService.getFormAnalytics(id);
    
    return {
      formId: id,
      totalResponses: analytics.totalResponses,
      lastResponse: analytics.lastResponse,
      isActive: form.isActive,
      isPublic: form.isPublic,
      analytics: analytics.analytics,
    };
  }

  async toggleActiveStatus(id: string, userId: string): Promise<Form> {
    const form = await this.formModel.findById(id);
    
    if (!form) {
      throw new NotFoundException('Form not found');
    }

    const formOwnerId = form.createdBy.toString();
    const requestUserId = userId.toString();

    if (formOwnerId !== requestUserId) {
      throw new ForbiddenException('Access denied');
    }

    form.isActive = !form.isActive;
    form.updatedAt = new Date();
    
    return form.save();
  }

  async getResponseCount(formId: string): Promise<number> {
    return this.responseService.getResponseCount(formId);
  }

  async getFormResponses(formId: string, filters?: any): Promise<any[]> {
    return this.responseService.getResponsesByFormId(formId, filters);
  }

  // Public form methods (no authentication required)
  async findPublicForm(id: string): Promise<Form> {
    console.log('Finding public form with ID:', id);
    
    const form = await this.formModel.findById(id).exec();
    console.log('Form found:', form ? `Title: ${form.title}, isPublic: ${form.isPublic}, isActive: ${form.isActive}` : 'null');
    
    if (!form) {
      console.log('Form not found in database');
      throw new NotFoundException('Form not found');
    }

    if (!form.isPublic) {
      console.log('Form is not public');
      throw new ForbiddenException('This form is not public');
    }

    if (!form.isActive) {
      console.log('Form is not active');
      throw new ForbiddenException('This form is not currently accepting responses');
    }

    console.log('Returning public form successfully');
    return form;
  }

  async submitResponse(formId: string, responseData: any, ipAddress?: string, userAgent?: string): Promise<any> {
    // First, verify the form exists and is public/active
    await this.findPublicForm(formId);
    
    console.log('Submitting response for form:', formId, 'Data:', responseData);
    
    // Extract the responses from the request body
    const { responses, respondentEmail } = responseData;
    
    if (!responses) {
      throw new Error('No responses provided');
    }
    
    // Save the response using ResponseService
    const savedResponse = await this.responseService.createResponse({
      formId,
      responses,
      respondentEmail,
      ipAddress,
      userAgent,
    });
    
    console.log('Response saved successfully:', (savedResponse as any)._id);
    
    return {
      success: true,
      message: 'Response submitted successfully',
      responseId: (savedResponse as any)._id,
      formId: formId,
      submittedAt: savedResponse.submittedAt,
    };
  }
}