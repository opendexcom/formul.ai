import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Response, ResponseDocument } from '../schemas/response.schema';

export interface CreateResponseDto {
  formId: string;
  responses: Record<string, any>;
  respondentEmail?: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class ResponseService {
  constructor(
    @InjectModel(Response.name) private responseModel: Model<ResponseDocument>,
  ) {}

  async createResponse(createResponseDto: CreateResponseDto): Promise<Response> {
    const { formId, responses, respondentEmail, ipAddress, userAgent } = createResponseDto;

    // Convert the responses object to Answer array format
    const answers = Object.entries(responses).map(([questionId, value]) => ({
      questionId,
      value,
    }));

    // Check if response has text content for analytics
    const hasTextContent = answers.some(answer => {
      const value = answer.value;
      if (typeof value === 'string' && value.trim().length > 0) {
        return true;
      }
      if (Array.isArray(value)) {
        return value.some(v => typeof v === 'string' && v.trim().length > 0);
      }
      return false;
    });

    const response = new this.responseModel({
      formId: new Types.ObjectId(formId),
      respondentEmail,
      answers,
      submittedAt: new Date(),
      ipAddress,
      userAgent,
      metadata: {
        hasTextContent,
        processedForAnalytics: false,
        extractedKeywords: [],
      },
    });

    return response.save();
  }

  async getResponsesByFormId(formId: string, additionalFilters?: any): Promise<Response[]> {
    const query: any = { formId: new Types.ObjectId(formId) };
    
    // Merge additional filters if provided
    if (additionalFilters) {
      Object.assign(query, additionalFilters);
    }
    
    console.log('[getResponsesByFormId] MongoDB query:', JSON.stringify(query, null, 2));
    
    const results = await this.responseModel
      .find(query)
      .sort({ submittedAt: 1 }) // Sort ascending (oldest first) so filters work from bottom up
      .exec();
    
    console.log('[getResponsesByFormId] Found', results.length, 'responses');
    
    // Log first response metadata structure for debugging
    if (results.length > 0 && additionalFilters) {
      const firstResponse = results[0] as any;
      console.log('[getResponsesByFormId] First response metadata.overallSentiment:', JSON.stringify(firstResponse.metadata?.overallSentiment, null, 2));
    }
    
    return results;
  }

  async getResponseById(responseId: string): Promise<Response | null> {
    return this.responseModel.findById(responseId).exec();
  }

  async getResponseCount(formId: string): Promise<number> {
    return this.responseModel.countDocuments({ formId: new Types.ObjectId(formId) });
  }

  async deleteResponse(responseId: string): Promise<void> {
    await this.responseModel.findByIdAndDelete(responseId);
  }

  async getFormAnalytics(formId: string): Promise<any> {
    const responses = await this.getResponsesByFormId(formId);
    const totalResponses = responses.length;

    if (totalResponses === 0) {
      return {
        totalResponses: 0,
        analytics: {},
        lastResponse: null,
      };
    }

    // Group answers by questionId for analytics
    const analytics: Record<string, any> = {};

    responses.forEach(response => {
      response.answers.forEach(answer => {
        if (!analytics[answer.questionId]) {
          analytics[answer.questionId] = {
            questionId: answer.questionId,
            responses: [],
            valueCount: {},
          };
        }

        analytics[answer.questionId].responses.push(answer.value);

        // Count occurrences of each value (useful for multiple choice, etc.)
        const valueKey = Array.isArray(answer.value) 
          ? answer.value.join(', ') 
          : String(answer.value);
        
        analytics[answer.questionId].valueCount[valueKey] = 
          (analytics[answer.questionId].valueCount[valueKey] || 0) + 1;
      });
    });

    return {
      totalResponses,
      analytics,
      lastResponse: responses[0]?.submittedAt || null,
    };
  }
}