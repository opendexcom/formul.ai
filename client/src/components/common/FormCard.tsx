import React from 'react';
import { Edit, BarChart3, Eye, Share, Users } from 'lucide-react';
import { FormData } from '../../services/formsService';

interface FormCardProps {
  form: FormData;
  onEdit: (formId: string) => void;
  onPreview: (formId: string) => void;
  onAnalytics?: (formId: string) => void;
  onShare?: (formId: string) => void;
  responseCount?: number;
  className?: string;
}

const FormCard: React.FC<FormCardProps> = ({
  form,
  onEdit,
  onPreview,
  onAnalytics,
  onShare,
  responseCount = 0,
  className = ''
}) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  return (
    <div className={`bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow ${className}`}>
      <div className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">{form.title}</h3>
            <p className="text-gray-600 text-sm mb-3">{form.description || 'No description'}</p>
            <div className="flex items-center space-x-4 text-sm text-gray-500">
              <div className="flex items-center space-x-1">
                <Users className="w-4 h-4" />
                <span>{responseCount} responses</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${form.isActive ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                <span>{form.isActive ? 'Active' : 'Inactive'}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex justify-between items-center pt-4 border-t border-gray-100">
          <div className="text-xs text-gray-500">
            Created {form.createdAt ? formatDate(form.createdAt) : 'Unknown'}
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => onEdit(form._id!)}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-50"
              title="Edit"
            >
              <Edit className="w-4 h-4" />
            </button>
            {onAnalytics && (
              <button
                onClick={() => onAnalytics(form._id!)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-50"
                title="Analytics"
              >
                <BarChart3 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => onPreview(form._id!)}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-50"
              title="Preview Form"
            >
              <Eye className="w-4 h-4" />
            </button>
            {onShare && (
              <button
                onClick={() => onShare(form._id!)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-50"
                title="Share"
              >
                <Share className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FormCard;