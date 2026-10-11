import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '../ui';

interface CreateStudyModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (payload: { name: string; hypothesis?: string }) => Promise<void>;
  disabled?: boolean;
}

const CreateStudyModal: React.FC<CreateStudyModalProps> = ({
  open,
  onClose,
  onCreate,
  disabled,
}) => {
  const [name, setName] = useState('');
  const [hypothesis, setHypothesis] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || disabled) return;
    setSaving(true);
    setError('');
    try {
      await onCreate({
        name: name.trim(),
        hypothesis: hypothesis.trim() || undefined,
      });
      setName('');
      setHypothesis('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create study');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-study-title"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="create-study-title" className="text-lg font-semibold text-gray-900">
              Create new study
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Start a research study and configure variants next.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="study-name" className="mb-1 block text-sm font-medium text-gray-700">
              Study name
            </label>
            <input
              id="study-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              placeholder="Employee Feedback 2026"
              autoFocus
            />
          </div>
          <div>
            <label
              htmlFor="study-hypothesis"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Hypothesis (optional)
            </label>
            <textarea
              id="study-hypothesis"
              value={hypothesis}
              onChange={(event) => setHypothesis(event.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              placeholder="What do you want to learn from this study?"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={saving} disabled={disabled || !name.trim()}>
              Create study
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateStudyModal;
