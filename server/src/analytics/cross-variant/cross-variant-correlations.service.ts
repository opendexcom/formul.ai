import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Response, ResponseDocument } from '../../schemas/response.schema';
import { Citation, VariantKey } from '../../projects/comparative-report.types';
import { VariantAnalyticsBundle } from './cross-variant-metrics.service';

@Injectable()
export class CrossVariantCorrelationsService {
  constructor(
    @InjectModel(Response.name) private readonly responseModel: Model<ResponseDocument>,
  ) {}

  async collectCitations(
    bundles: VariantAnalyticsBundle[],
    maxPerVariant = 30,
  ): Promise<Citation[]> {
    const citations: Citation[] = [];

    for (const bundle of bundles) {
      const formCitations = this.extractFromFormAnalytics(bundle);
      citations.push(...formCitations);

      const responses = await this.responseModel
        .find({ formId: bundle.formId })
        .sort({ submittedAt: -1 })
        .limit(maxPerVariant)
        .lean();

      for (const response of responses) {
        const keyQuotes = response.metadata?.quotes?.keyQuotes ?? [];
        for (const keyQuote of keyQuotes.slice(0, 2)) {
          if (!keyQuote.quote) continue;
          citations.push({
            responseId: String(response._id),
            variantKey: bundle.key,
            formId: String(bundle.formId),
            quote: keyQuote.quote,
            questionId: keyQuote.questionId,
            submittedAt: response.submittedAt
              ? new Date(response.submittedAt).toISOString()
              : undefined,
          });
        }
      }
    }

    return this.dedupeCitations(citations).slice(0, maxPerVariant * bundles.length);
  }

  private extractFromFormAnalytics(bundle: VariantAnalyticsBundle): Citation[] {
    const quotes = bundle.form.analytics?.quotes;
    if (!quotes) return [];

    const pools = [
      ...(quotes.representative ?? []),
      ...(quotes.highQuality ?? []),
      ...(quotes.deviant ?? []),
    ];

    return pools.slice(0, 5).map((quote) => ({
      responseId: quote.responseId,
      variantKey: bundle.key,
      formId: String(bundle.formId),
      quote: quote.text,
      submittedAt: quote.submittedAt
        ? new Date(quote.submittedAt).toISOString()
        : undefined,
    }));
  }

  private dedupeCitations(citations: Citation[]): Citation[] {
    const seen = new Set<string>();
    return citations.filter((citation) => {
      const key = `${citation.responseId}:${citation.quote.slice(0, 40)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  groupCitationsByVariant(citations: Citation[]): Record<VariantKey, Citation[]> {
    const grouped: Record<string, Citation[]> = {};
    for (const citation of citations) {
      grouped[citation.variantKey] = grouped[citation.variantKey] ?? [];
      grouped[citation.variantKey].push(citation);
    }
    return grouped as Record<VariantKey, Citation[]>;
  }
}
