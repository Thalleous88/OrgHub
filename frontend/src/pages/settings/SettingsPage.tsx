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
import { useProfile, useUpdateProfile } from '../../hooks/queries/useUser';
import { useAuth } from '../../context/AuthContext';
import { getApiErrorMessage } from '../../lib/apiError';

export default function SettingsPage() {
  const { user } = useAuth();
  const { data: profile, isLoading, isError, error, refetch } = useProfile();
  const updateMut = useUpdateProfile();
  const toast = useToast();

  const [fullName, setFullName] = useState('');
  const [major, setMajor] = useState('');
  const [campus, setCampus] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? '');
      setMajor(profile.major ?? '');
      setCampus(profile.campus_location ?? '');
    }
  }, [profile]);

  const handleSubmit = async (e: FormEvent) => {
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

  return (
    <AppShell>
      <PageHeader title="Settings" subtitle="Manage your profile information." />

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
        <form
          onSubmit={handleSubmit}
          style={{
            maxWidth: 520,
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
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
      )}
    </AppShell>
  );
}
