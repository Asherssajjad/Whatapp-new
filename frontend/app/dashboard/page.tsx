'use client';
import ContactList from '@/components/chat/ContactList';
import ChatWindow from '@/components/chat/ChatWindow';
import ContactDetails from '@/components/chat/ContactDetails';
import { useUIStore } from '@/store/ui';

export default function DashboardPage() {
  const selectedContact = useUIStore(s => s.selectedContact);

  return (
    <div className="flex h-full min-h-0">
      <ContactList />
      <ChatWindow />
      {selectedContact && <ContactDetails />}
    </div>
  );
}
