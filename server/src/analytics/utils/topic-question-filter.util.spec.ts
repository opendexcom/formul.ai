import {
  extractQuestionFocusPhrases,
  filterDiscoveredTopics,
  isQuestionEchoTopic,
} from './topic-question-filter.util';

describe('topic-question-filter.util', () => {
  const form = {
    questions: [
      { id: 'q4', type: 'textarea', title: 'Feedback on Company Culture' },
      { id: 'q5', type: 'textarea', title: 'Suggestions for Improvement' },
      { id: 'q3', type: 'rating', title: 'Overall Job Satisfaction' },
    ],
  } as any;

  it('extracts focus phrases from open-ended questions', () => {
    const phrases = extractQuestionFocusPhrases(form);
    expect(phrases).toContain('feedback on company culture');
    expect(phrases).toContain('company culture');
    expect(phrases).toContain('suggestions for improvement');
  });

  it('flags company culture as a question echo', () => {
    const phrases = extractQuestionFocusPhrases(form);
    expect(isQuestionEchoTopic('Company Culture', phrases)).toBe(true);
  });

  it('keeps substantive sub-themes', () => {
    const phrases = extractQuestionFocusPhrases(form);
    expect(isQuestionEchoTopic('Team Collaboration', phrases)).toBe(false);
    expect(isQuestionEchoTopic('Recognition', phrases)).toBe(false);
    expect(isQuestionEchoTopic('Feedback', phrases)).toBe(false);
  });

  it('filters question echoes from topic lists', () => {
    const phrases = extractQuestionFocusPhrases(form);
    expect(
      filterDiscoveredTopics(
        ['Company Culture', 'Team Collaboration', 'Recognition'],
        phrases,
      ),
    ).toEqual(['Team Collaboration', 'Recognition']);
  });
});
