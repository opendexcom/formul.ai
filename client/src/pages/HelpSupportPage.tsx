import React from 'react';
import PluginSlot from '../plugins/PluginSlot';
import { shellCardClass, shellPageDescriptionClass, shellPageTitleClass } from '../components/shell/design-tokens';

const faqItems = [
  {
    question: 'What is a study vs a form?',
    answer:
      'A study is your research project. Each variant in the study is backed by a form — the technical questionnaire respondents fill out.',
  },
  {
    question: 'How do variants work?',
    answer:
      'Variants let you test different questionnaire versions (for example main, A, and B). Compare results once you collect enough responses.',
  },
  {
    question: 'Are there usage limits?',
    answer:
      'Open-source deployments may run without enforced quotas. Enterprise plans include study, response, and AI token limits with billing visibility.',
  },
];

const HelpSupportPage: React.FC = () => {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className={shellPageTitleClass}>Help & Support</h1>
        <p className={shellPageDescriptionClass}>
          Learn how to design studies, collect responses, and run AI analysis.
        </p>
      </div>

      <div className={shellCardClass}>
        <h2 className="text-base font-semibold text-gray-900">Getting started</h2>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-gray-700">
          <li>Create a study from Overview and add a hypothesis.</li>
          <li>Configure variants and design questionnaires in the editor.</li>
          <li>Share forms to collect responses.</li>
          <li>Run analytics per variant and compare results (Enterprise).</li>
        </ol>
      </div>

      <div className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900">FAQ</h2>
        {faqItems.map((item) => (
          <div key={item.question} className={shellCardClass}>
            <h3 className="text-sm font-semibold text-gray-900">{item.question}</h3>
            <p className="mt-2 text-sm text-gray-600">{item.answer}</p>
          </div>
        ))}
      </div>

      <div className={`${shellCardClass} border-blue-200 bg-blue-50`}>
        <h2 className="text-base font-semibold text-blue-900">Need more features?</h2>
        <p className="mt-2 text-sm text-blue-800">
          Cross-variant analysis, billing & usage management, document upload in AI chat, advanced
          integrations, and priority support are available in FormulAI Enterprise (EE). Contact us
          if you need these capabilities for your team.
        </p>
      </div>

      <PluginSlot name="help.eeContent" />
    </div>
  );
};

export default HelpSupportPage;
