import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, User as UserIcon } from 'lucide-react';
import { SettingsSubNav } from '../components/shell';
import { shellCardClass, shellPageDescriptionClass, shellPageTitleClass } from '../components/shell/design-tokens';
import { Alert, Button, LoadingSpinner, PasswordStrengthIndicator } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import userService, { type UserProfile } from '../services/userService';
import { validatePassword } from '../utils/passwordValidation';

const inputClassName =
  'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all';

const UserPreferencesPage: React.FC = () => {
  const { user, updateUser } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const data = await userService.getProfile();
        setProfile(data);
        setFirstName(data.firstName);
        setLastName(data.lastName);
      } catch (error) {
        setProfileError(error instanceof Error ? error.message : 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  const handleProfileSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setProfileError('');
    setProfileSuccess('');
    setProfileSaving(true);

    try {
      const updated = await userService.updateProfile({ firstName, lastName });
      setProfile(updated);
      updateUser({
        id: updated.id,
        email: updated.email,
        firstName: updated.firstName,
        lastName: updated.lastName,
        roles: updated.roles,
      });
      setProfileSuccess('Profile updated successfully.');
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Failed to update profile');
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    const { valid, errors } = validatePassword(newPassword);
    if (!valid) {
      setPasswordError(errors.join('. '));
      return;
    }

    setPasswordSaving(true);

    try {
      const result = await userService.changePassword({ currentPassword, newPassword });
      setPasswordSuccess(result.message);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : 'Failed to change password');
    } finally {
      setPasswordSaving(false);
    }
  };

  const memberSince = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  return (
    <div>
      <SettingsSubNav />
      {loading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <div className="space-y-8">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                <UserIcon className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h1 className={shellPageTitleClass}>Profile</h1>
                <p className={shellPageDescriptionClass}>
                  Manage your account details and password.
                </p>
              </div>
            </div>
          </div>

          <section className={shellCardClass}>
              <div className="border-b border-gray-200 px-6 py-4">
                <h2 className="text-lg font-medium text-gray-900">Personal information</h2>
              </div>

              <form onSubmit={handleProfileSubmit} className="space-y-5 px-6 py-6">
                {profileError && <Alert type="error" message={profileError} />}
                {profileSuccess && <Alert type="success" message={profileSuccess} />}

                <div>
                  <label htmlFor="email" className="mb-2 block text-sm font-medium text-gray-700">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={profile?.email ?? user?.email ?? ''}
                    disabled
                    className={`${inputClassName} cursor-not-allowed bg-gray-50 text-gray-500`}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Email cannot be changed from this page.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="firstName" className="mb-2 block text-sm font-medium text-gray-700">
                      First name
                    </label>
                    <input
                      id="firstName"
                      type="text"
                      value={firstName}
                      onChange={(event) => setFirstName(event.target.value)}
                      required
                      className={inputClassName}
                    />
                  </div>
                  <div>
                    <label htmlFor="lastName" className="mb-2 block text-sm font-medium text-gray-700">
                      Last name
                    </label>
                    <input
                      id="lastName"
                      type="text"
                      value={lastName}
                      onChange={(event) => setLastName(event.target.value)}
                      required
                      className={inputClassName}
                    />
                  </div>
                </div>

                {memberSince && (
                  <p className="text-sm text-gray-500">Member since {memberSince}</p>
                )}

                <div className="flex justify-end">
                  <Button type="submit" disabled={profileSaving}>
                    {profileSaving ? 'Saving...' : 'Save changes'}
                  </Button>
                </div>
              </form>
            </section>

          <section className={shellCardClass}>
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-medium text-gray-900">Change password</h2>
            </div>

              <form onSubmit={handlePasswordSubmit} className="space-y-5 px-6 py-6">
                {passwordError && <Alert type="error" message={passwordError} />}
                {passwordSuccess && <Alert type="success" message={passwordSuccess} />}

                <div>
                  <label htmlFor="currentPassword" className="mb-2 block text-sm font-medium text-gray-700">
                    Current password
                  </label>
                  <div className="relative">
                    <input
                      id="currentPassword"
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(event) => setCurrentPassword(event.target.value)}
                      required
                      autoComplete="current-password"
                      className={inputClassName}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword((value) => !value)}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
                      aria-label={showCurrentPassword ? 'Hide password' : 'Show password'}
                    >
                      {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="newPassword" className="mb-2 block text-sm font-medium text-gray-700">
                    New password
                  </label>
                  <div className="relative">
                    <input
                      id="newPassword"
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      required
                      autoComplete="new-password"
                      className={inputClassName}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((value) => !value)}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
                      aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {newPassword && <PasswordStrengthIndicator password={newPassword} />}
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="mb-2 block text-sm font-medium text-gray-700">
                    Confirm new password
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    required
                    autoComplete="new-password"
                    className={inputClassName}
                  />
                </div>

                <div className="flex justify-end">
                  <Button type="submit" disabled={passwordSaving}>
                    {passwordSaving ? 'Updating...' : 'Update password'}
                  </Button>
                </div>
              </form>
          </section>
        </div>
      )}
    </div>
  );
};

export default UserPreferencesPage;
