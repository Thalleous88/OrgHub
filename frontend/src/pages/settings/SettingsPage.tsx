import { useEffect, useState, type FormEvent } from 'react';
import { AppShell } from '../../components/layout/AppShell';
import {
  PageHeader,
  Field,
  Input,
  Button,
  Spinner,
  EmptyState,
  useToast,
} from '../../components/ui';
import { useProfile, useUpdateProfile, useChangePassword } from '../../hooks/queries/useUser';
import { useAuth } from '../../context/AuthContext';
import { getApiErrorMessage } from '../../lib/apiError';

export default function SettingsPage() {
  const { user } = useAuth();
  const { data: profile, isLoading, isError, error, refetch } = useProfile();
  const updateMut = useUpdateProfile();
  const changePwMut = useChangePassword();
  const toast = useToast();

  const [fullName, setFullName] = useState('');
  const [major, setMajor] = useState('');
  const [campus, setCampus] = useState('');
  const [formError, setFormError] = useState('');

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwError, setPwError] = useState('');

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? '');
      setMajor(profile.major ?? '');
      setCampus(profile.campus_location ?? '');
    }
  }, [profile]);

  const handleProfileSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');
    try {
      await updateMut.mutateAsync({
        full_name: fullName,
        major,
        campus_location: campus,
      });
      toast.success('Profile updated.');
    } catch (err) {
      setFormError(getApiErrorMessage(err, 'Failed to update profile.'));
    }
  };

  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setPwError('');
    if (newPassword.length < 8) {
      setPwError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('New passwords do not match.');
      return;
    }
    if (oldPassword === newPassword) {
      setPwError('New password must be different from current password.');
      return;
    }
    try {
      await changePwMut.mutateAsync({ oldPassword, newPassword });
      toast.success('Password changed.');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPwError(getApiErrorMessage(err, 'Failed to change password.'));
    }
  };

  return (
    <AppShell>
      <PageHeader title="Settings" subtitle="Manage your profile and account." />

      {isLoading ? (
        <Spinner label="Loading profile..." />
      ) : isError ? (
        <EmptyState
          title="Could not load profile"
          description={getApiErrorMessage(error, 'Try again in a moment.')}
          action={
            <Button variant="secondary" onClick={() => refetch()}>
              Retry
            </Button>
          }
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <form
            onSubmit={handleProfileSubmit}
            style={{
              maxWidth: 520,
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 4 }}>Profile</h3>
            {formError && (
              <div className="login-form__error">
                <span>{formError}</span>
              </div>
            )}

            <Field label="Email" hint="Your account email cannot be changed here.">
              <Input value={user?.email ?? ''} readOnly disabled />
            </Field>

            <Field label="Full name">
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your full name"
                required
                maxLength={255}
              />
            </Field>

            <Field label="Major">
              <Input
                value={major}
                onChange={(e) => setMajor(e.target.value)}
                placeholder="e.g. Computer Science"
                maxLength={255}
              />
            </Field>

            <Field label="Campus location">
              <Input
                value={campus}
                onChange={(e) => setCampus(e.target.value)}
                placeholder="e.g. Main Campus"
                maxLength={255}
              />
            </Field>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="primary" type="submit" loading={updateMut.isPending}>
                Save changes
              </Button>
            </div>
          </form>

          <form
            onSubmit={handlePasswordSubmit}
            style={{
              maxWidth: 520,
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              borderTop: '1px solid var(--border-subtle)',
              paddingTop: '2rem',
            }}
          >
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 4 }}>Change password</h3>
            {pwError && (
              <div className="login-form__error">
                <span>{pwError}</span>
              </div>
            )}

            <Field label="Current password">
              <Input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="Enter current password"
                required
                autoComplete="current-password"
              />
            </Field>

            <Field label="New password" hint="Must be at least 8 characters.">
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </Field>

            <Field label="Confirm new password">
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </Field>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="primary" type="submit" loading={changePwMut.isPending}>
                Change password
              </Button>
            </div>
          </form>
        </div>
      )}
    </AppShell>
  );
}
