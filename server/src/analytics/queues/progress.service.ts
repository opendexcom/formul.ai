import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { QueueName } from './queue.names';

export interface ProgressUpdate {
  taskId: string;
  type: 'start' | 'progress' | 'complete' | 'error' | 'responses_claimed' | 'responses_processing' | 'responses_processed' | 'reprocessed';
  message: string;
  progress: number;
  stats?: any;
  processedResponseIds?: string[];
  modifiedCount?: number;
}

@Injectable()
export class ProgressService {
  constructor(
    @InjectQueue(QueueName.ORCHESTRATION) private orchestrationQueue: Queue,
  ) {}

  async publishProgress(update: ProgressUpdate): Promise<void> {
    // Use Bull's built-in Redis client to publish events
    const client = this.orchestrationQueue.client;
    await client.publish(
      'analytics:progress',
      JSON.stringify(update),
    );
  }

  async onProgress(callback: (update: ProgressUpdate) => void): Promise<() => Promise<void>> {
    // Create a duplicate connection for subscribing (Bull pattern)
    const client = this.orchestrationQueue.client;
    const subscriber = client.duplicate();

    // Wait for subscriber to be ready before subscribing
    await new Promise<void>((resolve, reject) => {
      subscriber.once('ready', () => resolve());
      subscriber.once('error', (err) => reject(err));
      // If already connected, resolve immediately
      if (subscriber.status === 'ready') {
        resolve();
      }
    });

    await subscriber.subscribe('analytics:progress');

    const handler = (channel: string, message: string) => {
      if (channel === 'analytics:progress') {
        try {
          const update = JSON.parse(message);
          callback(update);
        } catch {
          // Ignore parse errors
        }
      }
    };

    subscriber.on('message', handler);

    // Return unsubscribe/cleanup function
    return async () => {
      try {
        subscriber.removeListener('message', handler);
        await subscriber.unsubscribe('analytics:progress');
      } catch (e) {
        // Ignore errors during cleanup
        console.warn('[ProgressService] Error during unsubscribe:', e.message);
      } finally {
        // Close the duplicate connection gracefully
        try { 
          await subscriber.quit(); 
        } catch (e) {
          // Force disconnect if quit fails
          try { subscriber.disconnect(); } catch { /* noop */ }
        }
      }
    };
  }
}
