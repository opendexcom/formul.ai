import React, { useState } from 'react';
import { Copy, QrCode, Share2, Check, Eye } from 'lucide-react';
import { FormData } from '../../services/formsService';
import { Button } from '../ui';
import Modal from '../ui/Modal';

interface ShareFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  form: FormData | null;
  onFormUpdate?: (updatedForm: FormData) => void;
}

const ShareFormModal: React.FC<ShareFormModalProps> = ({
  isOpen,
  onClose,
  form,
  onFormUpdate
}) => {
  const [activeTab, setActiveTab] = useState<'link' | 'email' | 'embed' | 'settings'>('link');
  const [copied, setCopied] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [emailStatus, setEmailStatus] = useState<string>('');

  if (!form) return null;

  // Generate the public form URL for data entry
  const formUrl = `${window.location.origin}/form/${form._id}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(formUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy link:', error);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = formUrl;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (fallbackError) {
        console.error('Fallback copy failed:', fallbackError);
      }
      document.body.removeChild(textArea);
    }
  };

  const handleGenerateQR = () => {
    // This could open a QR code generator modal or integrate with a QR code service
    window.open(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(formUrl)}`, '_blank');
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: form.title,
          text: form.description || 'Fill out this form',
          url: formUrl,
        });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    } else {
      // Fallback - copy to clipboard
      handleCopyLink();
    }
  };

  const updateFormSetting = async (field: string, value: any) => {
    if (!form || !form._id) return;
    
    setUpdating(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api'}/forms/${form._id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ [field]: value }),
      });

      if (!response.ok) {
        throw new Error('Failed to update form');
      }

      const updatedForm = await response.json();
      if (onFormUpdate) {
        onFormUpdate(updatedForm);
      }
    } catch (error) {
      console.error('Error updating form:', error);
    } finally {
      setUpdating(false);
    }
  };

  const handleSendInvitations = async (invitationData: {
    emails: string[];
    subject: string;
    message: string;
  }) => {
    if (!form || !form._id) return;

    setUpdating(true);
    setEmailStatus('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api'}/forms/${form._id}/send-invitations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(invitationData),
      });

      if (!response.ok) {
        throw new Error('Failed to send invitations');
      }

      const result = await response.json();
      setEmailStatus(`Successfully sent ${result.totalSent} invitations${result.totalFailed > 0 ? ` (${result.totalFailed} failed)` : ''}`);
      
      // Auto-clear status after 5 seconds
      setTimeout(() => setEmailStatus(''), 5000);
    } catch (error: any) {
      setEmailStatus(`Error: ${error.message}`);
      console.error('Error sending invitations:', error);
    } finally {
      setUpdating(false);
    }
  };

  const tabs = [
    { id: 'link', label: 'Link', icon: null },
    { id: 'email', label: 'Email', icon: null },
    { id: 'embed', label: 'Embed', icon: null },
    { id: 'settings', label: 'Settings', icon: null },
  ];

  const EmailInvitationTab = () => {
    const [emails, setEmails] = useState('');
    const [subject, setSubject] = useState(`Please fill out: ${form?.title || ''}`);
    const [message, setMessage] = useState(`Hi,\n\nPlease fill out this form: ${form?.title || ''}\n\n${form?.description || ''}\n\nForm link: ${formUrl}\n\nThank you!`);

    const handleSendEmails = async () => {
      const emailList = emails.split(',').map(email => email.trim()).filter(email => email);
      
      if (emailList.length === 0) {
        setEmailStatus('Please enter at least one email address');
        return;
      }

      await handleSendInvitations({
        emails: emailList,
        subject,
        message,
      });

      // Clear form on success
      if (!emailStatus.includes('Error')) {
        setEmails('');
      }
    };

    return (
      <div className="space-y-4">
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-2">Share via Email</h4>
          <p className="text-sm text-gray-600 mb-4">Send an email with the form link</p>
          
          {!form?.isPublic && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                ⚠️ This form is not public. Please make it public in the Settings tab before sending invitations.
              </p>
            </div>
          )}
          
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                To (email addresses)
              </label>
              <input
                type="email"
                placeholder="Enter email addresses separated by commas"
                value={emails}
                onChange={(e) => setEmails(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Separate multiple emails with commas
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Subject
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Message
              </label>
              <textarea
                rows={6}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                The form link will be automatically included in the email
              </p>
            </div>
          </div>
          
          {emailStatus && (
            <div className={`mt-4 p-3 rounded-lg ${
              emailStatus.includes('Error') 
                ? 'bg-red-50 border border-red-200 text-red-800' 
                : 'bg-green-50 border border-green-200 text-green-800'
            }`}>
              {emailStatus}
            </div>
          )}
          
          <div className="mt-4 flex space-x-3">
            <Button 
              variant="primary" 
              size="sm"
              onClick={handleSendEmails}
              disabled={updating || !form?.isPublic}
              loading={updating}
            >
              {updating ? 'Sending...' : 'Send Invitations'}
            </Button>
            
            {emails && (
              <Button 
                variant="secondary" 
                size="sm"
                onClick={() => {
                  setEmails('');
                  setEmailStatus('');
                }}
              >
                Clear
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'link':
        return (
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-2">Share Link</h4>
              <p className="text-sm text-gray-600 mb-4">Copy and share this link with anyone</p>
              
              <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg border">
                <input
                  type="text"
                  value={formUrl}
                  readOnly
                  className="flex-1 bg-transparent text-sm text-gray-700 outline-none"
                />
                <button
                  onClick={handleCopyLink}
                  className="p-1 text-gray-500 hover:text-gray-700"
                  title="Copy link"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-600" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>

              <div className="flex space-x-2 mt-4">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={QrCode}
                  onClick={handleGenerateQR}
                >
                  Generate QR Code
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={Share2}
                  onClick={handleShare}
                >
                  Share
                </Button>
              </div>

              <div className={`mt-4 p-3 rounded-lg border ${
                form.isPublic 
                  ? 'bg-blue-50 border-blue-200' 
                  : 'bg-yellow-50 border-yellow-200'
              }`}>
                <div className="flex items-center space-x-2">
                  <Eye className={`w-4 h-4 ${
                    form.isPublic ? 'text-blue-600' : 'text-yellow-600'
                  }`} />
                  <span className={`text-sm font-medium ${
                    form.isPublic ? 'text-blue-900' : 'text-yellow-900'
                  }`}>
                    {form.isPublic ? 'Public' : 'Private'}
                  </span>
                </div>
                <p className={`text-sm mt-1 ${
                  form.isPublic ? 'text-blue-700' : 'text-yellow-700'
                }`}>
                  {form.isPublic 
                    ? 'Anyone with this link can access and fill out your form.'
                    : 'This form is private. You need to make it public before sharing.'
                  }
                </p>
                {!form.isPublic && (
                  <p className="text-xs text-yellow-600 mt-2">
                    Go to Settings tab to make this form public.
                  </p>
                )}
              </div>
            </div>
          </div>
        );

      case 'email':
        return <EmailInvitationTab />;

      case 'embed':
        return (
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-2">Embed Form</h4>
              <p className="text-sm text-gray-600 mb-4">Add this form to your website</p>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  HTML Embed Code
                </label>
                <textarea
                  readOnly
                  rows={4}
                  value={`<iframe src="${formUrl}" width="100%" height="600" frameborder="0" marginheight="0" marginwidth="0">Loading...</iframe>`}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-sm font-mono"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-2"
                  onClick={() => {
                    const embedCode = `<iframe src="${formUrl}" width="100%" height="600" frameborder="0" marginheight="0" marginwidth="0">Loading...</iframe>`;
                    navigator.clipboard.writeText(embedCode);
                  }}
                >
                  Copy Embed Code
                </Button>
              </div>
            </div>
          </div>
        );

      case 'settings':
        return (
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-2">Access Settings</h4>
              <p className="text-sm text-gray-600 mb-4">Control who can access your form</p>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-gray-900">Public Access</span>
                    <p className="text-sm text-gray-600">Allow anyone with the link to access this form</p>
                  </div>
                  <button
                    onClick={() => updateFormSetting('isPublic', !form.isPublic)}
                    disabled={updating}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      form.isPublic ? 'bg-blue-600' : 'bg-gray-200'
                    } ${updating ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        form.isPublic ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-gray-900">Form Status</span>
                    <p className="text-sm text-gray-600">Control whether the form accepts responses</p>
                  </div>
                  <button
                    onClick={() => updateFormSetting('isActive', !form.isActive)}
                    disabled={updating}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      form.isActive ? 'bg-green-600' : 'bg-gray-200'
                    } ${updating ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        form.isActive ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                
                <div className="border-t border-gray-200 pt-3">
                  <span className="text-sm font-medium text-gray-900">Response Limit</span>
                  <p className="text-sm text-gray-600 mb-2">Set maximum number of responses</p>
                  <input
                    type="number"
                    placeholder="No limit"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div className="border-t border-gray-200 pt-3">
                  <span className="text-sm font-medium text-gray-900">Closing Date</span>
                  <p className="text-sm text-gray-600 mb-2">Automatically close form on specific date</p>
                  <input
                    type="datetime-local"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Share Form"
      className="max-w-2xl"
    >
      <div className="mb-4">
        <p className="text-sm text-gray-600">
          Share "{form.title}" with others and manage access settings
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {renderTabContent()}
    </Modal>
  );
};

export default ShareFormModal;