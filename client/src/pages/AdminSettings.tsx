import React, { useState, useEffect } from 'react';
import { apiClient } from '../services/apiClient';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { Shield, Check, AlertCircle } from 'lucide-react';
import { Header } from '../components/common';

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
                setAllowRegistration(setting);
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

    // Simple role check - in a real app this would be more robust
    if (!user || !user.roles?.includes('admin')) {
        return <Navigate to="/dashboard" replace />;
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <Header />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="bg-white shadow rounded-lg overflow-hidden">
                    <div className="px-6 py-5 border-b border-gray-200 flex items-center">
                        <Shield className="h-6 w-6 text-blue-600 mr-3" />
                        <h1 className="text-xl font-semibold text-gray-900">Admin Settings</h1>
                    </div>

                    <div className="p-6">
                        {error && (
                            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center text-red-700">
                                <AlertCircle className="h-5 w-5 mr-2" />
                                {error}
                            </div>
                        )}

                        {success && (
                            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center text-green-700">
                                <Check className="h-5 w-5 mr-2" />
                                {success}
                            </div>
                        )}

                        <div className="flex items-center justify-between py-4 border-b border-gray-100">
                            <div>
                                <h3 className="text-lg font-medium text-gray-900">User Registration</h3>
                                <p className="text-sm text-gray-500 mt-1">
                                    Allow new users to sign up for an account.
                                </p>
                            </div>

                            <button
                                onClick={handleToggle}
                                disabled={loading}
                                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${allowRegistration ? 'bg-blue-600' : 'bg-gray-200'
                                    }`}
                            >
                                <span
                                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${allowRegistration ? 'translate-x-5' : 'translate-x-0'
                                        }`}
                                />
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default AdminSettings;
