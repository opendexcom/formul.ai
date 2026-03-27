import { Processor, Process, OnQueueFailed } from '@nestjs/bull';
import type { Job } from 'bull';
import { Types } from 'mongoose';
import { QueueName } from './queue.names';
import type { TopicClusteringJobData } from './queue.names';
import { TopicClusterer } from '../processors/topic.clusterer';
import { ProgressService } from './progress.service';
import { DeadLetterService } from './dead-letter.service';

@Processor(QueueName.TOPIC_CLUSTERING)
export class TopicClusteringConsumer {
  constructor(
    private readonly topicClusterer: TopicClusterer,
    private readonly progressService: ProgressService,
    private readonly deadLetterService: DeadLetterService,
  ) {}

  @Process('cluster-topics')
  async handleClustering(job: Job<TopicClusteringJobData>) {
    const { taskId, formId } = job.data;
    console.log(`[TopicClusteringConsumer][${taskId}] Starting topic clustering job for form ${formId}`);
    await this.progressService.publishProgress({
      taskId,
      type: 'progress',
      message: `Clustering topics for form ${formId}`,
      progress: 50,
    });
    // Convert formId to ObjectId
    const objectIdFormId = new Types.ObjectId(formId);
    console.log(`[TopicClusteringConsumer][${taskId}] Calling topicClusterer.clusterAndStoreCanonicalTopics`);
    const result = await this.topicClusterer.clusterAndStoreCanonicalTopics(
      objectIdFormId,
      taskId,
      (update: any) => this.progressService.publishProgress({
        taskId,
        type: update.type === 'progress' || update.type === 'start' || update.type === 'complete' || update.type === 'error' ? update.type : 'progress',
        message: update.message,
        progress: update.progress,
        stats: update.stats,
      }),
    );
    console.log(`[TopicClusteringConsumer][${taskId}] Topic clustering completed: ${result.canonicalTopics.length} canonical topics`);
    return { success: true, canonicalTopicsCount: result.canonicalTopics.length };
  }

  @OnQueueFailed()
  onFailed(job: Job<TopicClusteringJobData>, error: Error) {
    // eslint-disable-next-line no-console
    console.error(`[TopicClustering] Job ${job.id} failed:`, error.message);
    this.deadLetterService.forwardWhenExhausted(QueueName.TOPIC_CLUSTERING, job, error);
  }
}
