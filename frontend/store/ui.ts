import { create } from 'zustand';
import type { Contact } from '@/types';

interface UIState {
  selectedContact: Contact | null;
  sidebarOpen: boolean;
  activeTab: string;
  setSelectedContact: (contact: Contact | null) => void;
  setSidebarOpen: (open: boolean) => void;
  setActiveTab: (tab: string) => void;
  notifications: Array<{ id: string; type: 'info' | 'success' | 'warning' | 'error'; message: string }>;
  addNotification: (type: 'info' | 'success' | 'warning' | 'error', message: string) => void;
  removeNotification: (id: string) => void;
}

export const useUIStore = create<UIState>(set => ({
  selectedContact: null,
  sidebarOpen: true,
  activeTab: 'chats',
  notifications: [],

  setSelectedContact: contact => set({ selectedContact: contact }),
  setSidebarOpen: open => set({ sidebarOpen: open }),
  setActiveTab: tab => set({ activeTab: tab }),

  addNotification: (type, message) => {
    const id = Math.random().toString(36).slice(2);
    set(state => ({ notifications: [...state.notifications, { id, type, message }] }));
    setTimeout(() => set(state => ({ notifications: state.notifications.filter(n => n.id !== id) })), 5000);
  },

  removeNotification: id =>
    set(state => ({ notifications: state.notifications.filter(n => n.id !== id) })),
}));
