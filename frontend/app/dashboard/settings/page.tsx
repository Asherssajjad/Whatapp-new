'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save, Key, Loader2, Bot, Globe, Building2 } from 'lucide-react';
import { authApi, api } from '@/services/api';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useUIStore } from '@/store/ui';

export default function SettingsPage() {
  const { user } = useAuthStore();
  const { addNotification } = useUIStore();
  const queryClient = useQueryClient();

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');

  const [orgName, setOrgName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [businessType, setBusinessType] = useState('GENERAL');
  const [orgLoaded, setOrgLoaded] = useState(false);

  useQuery({
    queryKey: ['org-settings', user?.organizationId],
    queryFn: async () => {
      if (!user?.organizationId) return null;
      const res = await api.get('/admin/organizations');
      const orgs = res.data as Array<{ id: string; name: string; websiteUrl?: string; specialInstructions?: string }>;
      const org = orgs.find(o => o.id === user.organizationId) ?? orgs[0];
      if (org && !orgLoaded) {
        setOrgName(org.name ?? '');
        setWebsiteUrl(org.websiteUrl ?? '');
        setSpecialInstructions(org.specialInstructions ?? '');
        setBusinessType((org as { businessType?: string }).businessType ?? 'GENERAL');
        setOrgLoaded(true);
      }
      return org;
    },
    enabled: !!user?.organizationId,
  });

  const saveOrgMutation = useMutation({
    mutationFn: async () => {
      const orgId = user?.organizationId;
      if (!orgId) throw new Error('No organization linked to your account');
      return api.put(`/admin/organizations/${orgId}`, { name: orgName, websiteUrl, specialInstructions, businessType });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['org-settings'] });
      addNotification('success', 'Bot settings saved — takes effect on next message');
    },
    onError: () => addNotification('error', 'Failed to save settings'),
  });

  const changePwMutation = useMutation({
    mutationFn: () => authApi.changePassword(currentPw, newPw),
    onSuccess: () => {
      addNotification('success', 'Password changed');
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    },
    onError: () => addNotification('error', 'Failed to change password'),
  });

  return (
    <div className="flex-1 overflow-y-auto p-4 lg:p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="pt-14 lg:pt-0">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground text-sm mt-1">Configure your AI bot and account</p>
        </div>

        {/* Bot Configuration */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Bot className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-foreground">Bot Configuration</h2>
          </div>
          <p className="text-xs text-muted-foreground -mt-1">The AI uses these to represent your business correctly</p>

          <div className="grid gap-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                <Building2 className="w-3 h-3 inline mr-1" />Business Name
              </label>
              <Input
                value={orgName}
                onChange={e => setOrgName(e.target.value)}
                placeholder="e.g. Rootout Digital Agency"
              />
              <p className="text-xs text-muted-foreground mt-1">Bot will introduce itself as this business</p>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                <Globe className="w-3 h-3 inline mr-1" />Website URL
              </label>
              <Input
                value={websiteUrl}
                onChange={e => setWebsiteUrl(e.target.value)}
                placeholder="https://rootout.pk"
              />
              <p className="text-xs text-muted-foreground mt-1">Bot will share this when asked for website</p>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                Business Type
              </label>
              <select
                value={businessType}
                onChange={e => setBusinessType(e.target.value)}
                className="w-full h-10 px-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500/50"
              >
                <option value="ECOMMERCE">🛒 E-commerce (Products / Orders)</option>
                <option value="SERVICES">🏢 Services (Courses / Appointments)</option>
                <option value="GENERAL">⚡ General</option>
              </select>
              <p className="text-xs text-muted-foreground mt-1">Controls whether bot captures orders or appointments</p>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                Bot Instructions
              </label>
              <textarea
                value={specialInstructions}
                onChange={e => setSpecialInstructions(e.target.value)}
                rows={4}
                className="w-full px-3 py-2.5 bg-accent rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                placeholder="e.g. We are a digital marketing agency based in Lahore. Always respond in Roman Urdu. Our pricing starts from Rs. 15,000/month..."
              />
              <p className="text-xs text-muted-foreground mt-1">Custom instructions for the AI — be as specific as possible</p>
            </div>
          </div>

          <Button
            onClick={() => saveOrgMutation.mutate()}
            disabled={!orgName || saveOrgMutation.isPending}
            className="w-full"
          >
            {saveOrgMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Bot Settings
          </Button>
        </div>

        {/* Change Password */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
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
            onClick={() => {
              if (newPw !== confirmPw) { addNotification('error', 'Passwords do not match'); return; }
              if (newPw.length < 8) { addNotification('error', 'Min 8 characters'); return; }
              changePwMutation.mutate();
            }}
            disabled={!currentPw || !newPw || !confirmPw || changePwMutation.isPending}
            className="w-full"
          >
            {changePwMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Update Password
          </Button>
        </div>
      </div>
    </div>
  );
}
