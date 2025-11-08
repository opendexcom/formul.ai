import React from 'react';
import { FormSettings as FormSettingsType } from '../../services/formsService';

interface FormSettingsProps {
  settings: FormSettingsType;
  isActive: boolean;
  isPublic: boolean;
  onUpdateSettings: (settings: FormSettingsType) => void;
  onToggleActive: (isActive: boolean) => void;
  onTogglePublic: (isPublic: boolean) => void;
}

const FormSettings: React.FC<FormSettingsProps> = ({
  settings,
  isActive,
  isPublic,
  onUpdateSettings,
  onToggleActive,
  onTogglePublic,
}) => {
  const updateSettings = (updates: Partial<FormSettingsType>) => {
    onUpdateSettings({ ...settings, ...updates });
  };

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Form Settings</h2>
          <p className="text-sm text-gray-600 mt-1">Configure how your form behaves and appears</p>
        </div>

        <div className="p-6 space-y-8">
          {/* General Settings */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">General</h3>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-900">Form Status</label>
                  <p className="text-sm text-gray-500">
                    {isActive ? 'Form is active and accepting responses' : 'Form is inactive and not accepting responses'}
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => onToggleActive(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-900">Public Form</label>
                  <p className="text-sm text-gray-500">
                    {isPublic ? 'Anyone with the link can access this form' : 'Only you can access this form'}
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={(e) => onTogglePublic(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Response Settings */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Responses</h3>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-900">Allow Multiple Responses</label>
                  <p className="text-sm text-gray-500">
                    Allow users to submit multiple responses to this form
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.allowMultipleResponses}
                    onChange={(e) => updateSettings({ allowMultipleResponses: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-900">Require Login</label>
                  <p className="text-sm text-gray-500">
                    Users must be logged in to submit responses
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.requireLogin}
                    onChange={(e) => updateSettings({ requireLogin: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Display Settings */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Display</h3>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-900">Show Progress Bar</label>
                  <p className="text-sm text-gray-500">
                    Display a progress bar showing form completion
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.showProgressBar}
                    onChange={(e) => updateSettings({ showProgressBar: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Theme Settings */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Theme</h3>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Primary Color
                </label>
                <div className="flex items-center space-x-4">
                  <input
                    type="color"
                    value={settings.customTheme?.primaryColor || '#3B82F6'}
                    onChange={(e) => updateSettings({
                      customTheme: {
                        ...settings.customTheme,
                        primaryColor: e.target.value
                      }
                    })}
                    className="w-12 h-10 border border-gray-300 rounded-md cursor-pointer"
                  />
                  <input
                    type="text"
                    value={settings.customTheme?.primaryColor || '#3B82F6'}
                    onChange={(e) => updateSettings({
                      customTheme: {
                        ...settings.customTheme,
                        primaryColor: e.target.value
                      }
                    })}
                    className="flex-1 p-2 border border-gray-300 rounded-md"
                    placeholder="#3B82F6"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Background Color
                </label>
                <div className="flex items-center space-x-4">
                  <input
                    type="color"
                    value={settings.customTheme?.backgroundColor || '#F9FAFB'}
                    onChange={(e) => updateSettings({
                      customTheme: {
                        ...settings.customTheme,
                        backgroundColor: e.target.value
                      }
                    })}
                    className="w-12 h-10 border border-gray-300 rounded-md cursor-pointer"
                  />
                  <input
                    type="text"
                    value={settings.customTheme?.backgroundColor || '#F9FAFB'}
                    onChange={(e) => updateSettings({
                      customTheme: {
                        ...settings.customTheme,
                        backgroundColor: e.target.value
                      }
                    })}
                    className="flex-1 p-2 border border-gray-300 rounded-md"
                    placeholder="#F9FAFB"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Font Family
                </label>
                <select
                  value={settings.customTheme?.fontFamily || 'Inter'}
                  onChange={(e) => updateSettings({
                    customTheme: {
                      ...settings.customTheme,
                      fontFamily: e.target.value
                    }
                  })}
                  className="w-full p-2 border border-gray-300 rounded-md"
                >
                  <option value="Inter">Inter</option>
                  <option value="Arial">Arial</option>
                  <option value="Helvetica">Helvetica</option>
                  <option value="Georgia">Georgia</option>
                  <option value="Times New Roman">Times New Roman</option>
                  <option value="Courier New">Courier New</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FormSettings;