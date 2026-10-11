import React, { useState, useEffect } from 'react';
import { apiClient } from '../services/apiClient';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { Shield, Check, AlertCircle } from 'lucide-react';
import { AdminSubNav } from '../components/shell';
import { shellCardClass, shellPageDescriptionClass, shellPageTitleClass } from '../components/shell/design-tokens';

const AdminSettings: React.FC = () => {
    const { user, loading: authLoading } = useAuth();
    const [allowRegistration, setAllowRegistration] = useState<boolean>(true);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const setting = await (apiClient as any).getRegistrationSetting();
                setAllowRegistration(setting.allowRegistration);
            } catch (err) {
                setError('Failed to fetch settings');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchSettings();
    }, []);

    const handleToggle = async () => {
        setLoading(true);
        setError('');
        setSuccess('');
        try {
            const newValue = !allowRegistration;
            await (apiClient as any).updateRegistrationSetting(newValue);
            setAllowRegistration(newValue);
            setSuccess(`Registration has been ${newValue ? 'enabled' : 'disabled'}`);
        } catch (err) {
            setError('Failed to update settings');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (authLoading) return <div>Loading...</div>;

    if (!user || !user.roles?.includes('admin')) {
        return <Navigate to="/overview" replace />;
    }

    return (
        <div>
            <AdminSubNav />
            <div className="space-y-8">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                            <Shield className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                            <h1 className={shellPageTitleClass}>Platform Settings</h1>
                            <p className={shellPageDescriptionClass}>
                                Configure global platform behavior.
                            </p>
                        </div>
                    </div>
                </div>

                <div className={shellCardClass}>
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h2 className="text-lg font-medium text-gray-900">User Registration</h2>
                            <p className="mt-1 text-sm text-gray-500">
                                Allow new users to create accounts on the landing page.
                            </p>
                        </div>
                        <button
                            onClick={handleToggle}
                            disabled={loading}
                            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${allowRegistration ? 'bg-blue-600' : 'bg-gray-200'
                                } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <span
                                aria-hidden="true"
                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${allowRegistration ? 'translate-x-5' : 'translate-x-0'
                                    }`}
                            />
                        </button>
                    </div>

                    {error && (
                        <div className="mt-4 flex items-center gap-2 text-sm text-red-600">
                            <AlertCircle className="h-4 w-4" />
                            {error}
                        </div>
                    )}

                    {success && (
                        <div className="mt-4 flex items-center gap-2 text-sm text-green-600">
                            <Check className="h-4 w-4" />
                            {success}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminSettings;
