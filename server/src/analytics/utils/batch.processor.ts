import { Injectable } from '@nestjs/common';
import { ResponseDocument } from '../../schemas/response.schema';

/**
 * Batch Processing Utilities
 * 
 * Provides utility functions for:
 * - Adaptive chunk sizing based on response characteristics
 * - Response chunking for parallel processing
 * - Wave-based processing coordination
 */
@Injectable()
export class BatchProcessor {
  
  /**
   * Calculate average response length across all answers
   */
  calculateAvgResponseLength(responses: ResponseDocument[]): number {
    const totalLength = responses.reduce((sum, r) => {
      return sum + r.answers.reduce((ansSum, ans) => ansSum + (ans.value?.length || 0), 0);
    }, 0);
    return totalLength / responses.length;
  }

  /**
   * Determine optimal chunk size based on response count and average length
   * 
   * Strategy:
   * - If responseCount is small (<= chunk size), return responseCount (single chunk)
   * - Long responses (>500 chars avg): smaller chunks (10) for better LLM performance
   * - Medium responses (200-500 chars): medium chunks (15)
   * - Short responses (<200 chars): larger chunks (25) for efficiency
   */
  adaptiveChunkSize(responseCount: number, avgLength: number): number {
    // Determine base chunk size based on response length
    let baseChunkSize: number;
    if (avgLength > 500) {
      baseChunkSize = 1; // Small chunks for long responses
    } else if (avgLength > 200) {
      baseChunkSize = 3; // Medium chunks for medium responses
    } else {
      baseChunkSize = 5; // Large chunks for short responses
    }

    // If we have fewer responses than the chunk size, just use one chunk
    if (responseCount <= baseChunkSize) {
      return responseCount;
    }

    return baseChunkSize;
  }

  /**
   * Split responses into chunks for batch processing
   */
  createResponseChunks(
    responses: ResponseDocument[],
    chunkSize: number
  ): ResponseDocument[][] {
    const chunks: ResponseDocument[][] = [];
    for (let i = 0; i < responses.length; i += chunkSize) {
      chunks.push(responses.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Process chunks in waves (batches of chunks processed in parallel)
   * This is a utility abstraction - the original implementation has this logic inline
   * 
   * @param chunks All chunks to process
   * @param waveSize Number of chunks to process in parallel (typically 4 in original)
   * @param processChunk Function to process a single chunk
   * @param onWaveComplete Optional callback after each wave completes
   */
  async processInWaves<T>(
    chunks: ResponseDocument[][],
    waveSize: number,
    processChunk: (chunk: ResponseDocument[], index: number) => Promise<T>,
    onWaveComplete?: (waveIndex: number, results: T[]) => void | Promise<void>
  ): Promise<T[]> {
    const allResults: T[] = [];
    
    for (let waveIndex = 0; waveIndex < chunks.length; waveIndex += waveSize) {
      const wave = chunks.slice(waveIndex, waveIndex + waveSize);
      
      // Process wave chunks in parallel
      const waveResults = await Promise.all(
        wave.map((chunk, idx) => processChunk(chunk, waveIndex + idx))
      );
      
      allResults.push(...waveResults);
      
      // Callback after wave completion
      if (onWaveComplete) {
        await onWaveComplete(Math.floor(waveIndex / waveSize), waveResults);
      }
    }
    
    return allResults;
  }

  /**
   * Calculate optimal wave size (concurrency level) based on total chunks
   * 
   * Original implementation uses hardcoded MAX_CONCURRENCY = 4
   * This method provides a more adaptive approach for future use
   * 
   * Strategy:
   * - Few chunks (<10): process 2-3 at a time
   * - Medium chunks (10-50): process 4-5 at a time
   * - Many chunks (>50): process 4-8 at a time
   */
  calculateWaveSize(totalChunks: number): number {
    // Match original behavior: default to 4
    if (totalChunks < 10) return Math.min(3, totalChunks);
    if (totalChunks < 50) return 4; // Match original MAX_CONCURRENCY
    return 8;
  }

  /**
   * Estimate processing time based on response characteristics
   * 
   * @param responseCount Total number of responses
   * @param avgLength Average response length
   * @returns Estimated time in milliseconds
   */
  estimateProcessingTime(responseCount: number, avgLength: number): number {
    // Base time per response (varies by length)
    const baseTimePerResponse = avgLength > 500 ? 2000 : 
                                avgLength > 200 ? 1000 : 
                                500;
    
    // Account for parallelization (diminishing returns)
    const parallelizationFactor = Math.sqrt(responseCount) / responseCount;
    
    return responseCount * baseTimePerResponse * parallelizationFactor;
  }
}
