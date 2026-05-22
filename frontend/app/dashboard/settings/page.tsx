'use client';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Save, Key, User, Loader2 } from 'lucide-react';
import { authApi } from '@/services/api';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useUIStore } from '@/store/ui';

export default function SettingsPage() {
  const { user } = useAuthStore();
  const { addNotification } = useUIStore();

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');

  const changePwMutation = useMutation({
    mutationFn: () => authApi.changePassword(currentPw, newPw),
    onSuccess: () => {
      addNotification('success', 'Password changed');
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    },
    onError: () => addNotification('error', 'Failed to change password'),
  });

  const handleChangePassword = () => {
    if (newPw !== confirmPw) { addNotification('error', 'Passwords do not match'); return; }
    if (newPw.length < 8) { addNotification('error', 'Password must be at least 8 characters'); return; }
    changePwMutation.mutate();
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your account preferences</p>
        </div>

        {/* Profile */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <User className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-semibold text-foreground">Profile</h2>
          </div>
          <div className="grid gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Name</label>
              <Input value={user?.name ?? ''} disabled className="bg-accent" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Email</label>
              <Input value={user?.email ?? ''} disabled className="bg-accent" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Role</label>
              <Input value={user?.role ?? ''} disabled className="bg-accent" />
            </div>
          </div>
        </div>

        {/* Change Password */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Key className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-semibold text-foreground">Change Password</h2>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Current Password</label>
              <Input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} placeholder="••••••••" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">New Password</label>
              <Input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="••••••••" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Confirm New Password</label>
              <Input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="••••••••" />
            </div>
          </div>
          <Button
            onClick={handleChangePassword}
            disabled={!currentPw || !newPw || !confirmPw || changePwMutation.isPending}
            className="w-full"
          >
            {changePwMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Update Password
          </Button>
        </div>

        {/* Info */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-semibold text-foreground mb-3">System Info</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Version</span>
              <span className="font-medium text-foreground">2.0.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">AI Model</span>
              <span className="font-medium text-foreground">GPT-4o</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Organization ID</span>
              <span className="font-mono text-xs text-foreground">{user?.organizationId ?? '—'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
