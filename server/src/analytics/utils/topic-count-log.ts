/**
 * Product logs for extracted topics must not include topic text
 * (it is derived from respondent answers).
 */
export function logResponseTopicCount(
  event: string,
  extra: { responseId: string; topicCount: number },
): void {
  console.log(event, {
    responseId: extra.responseId,
    topicCount: extra.topicCount,
  });
}
