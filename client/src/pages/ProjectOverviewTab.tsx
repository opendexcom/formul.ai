import React from 'react';
import { useProjectShell } from '../components/shell/ProjectShell';
import { StudyResearchForm } from '../components/studies/StudyResearchForm';
import { shellCardClass } from '../components/shell/design-tokens';

const ProjectOverviewTab: React.FC = () => {
  const { project, refresh } = useProjectShell();
  if (!project) return null;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className={`${shellCardClass} lg:col-span-2`}>
        <StudyResearchForm
          project={project}
          compact
          onProjectUpdated={async () => {
            await refresh();
          }}
        />
      </div>

      <div className={shellCardClass}>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Variants
        </h2>
        <p className="mt-3 text-3xl font-semibold text-gray-900">{project.variants.length}</p>
      </div>

      <div className={shellCardClass}>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Responses
        </h2>
        <p className="mt-3 text-3xl font-semibold text-gray-900">
          {(project.responseCount ?? 0).toLocaleString()}
        </p>
      </div>
    </div>
  );
};

export default ProjectOverviewTab;
