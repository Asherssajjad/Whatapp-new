'use client';
import ContactList from '@/components/chat/ContactList';
import ChatWindow from '@/components/chat/ChatWindow';
import ContactDetails from '@/components/chat/ContactDetails';
import { useUIStore } from '@/store/ui';
import { cn } from '@/lib/utils';

export default function DashboardPage() {
  const selectedContact = useUIStore(s => s.selectedContact);

  return (
    <div className="flex flex-1 min-h-0 h-full overflow-hidden">
      {/* Contact list: full width on mobile, fixed width on desktop */}
      {/* Hide on mobile when a contact is selected */}
      <div className={cn(
        'flex-shrink-0 w-full lg:w-80',
        selectedContact ? 'hidden lg:flex' : 'flex'
      )}>
        <ContactList />
      </div>

      {/* Chat window: hidden on mobile when no contact selected */}
      <div className={cn(
        'flex-1 min-w-0',
        !selectedContact ? 'hidden lg:flex' : 'flex'
      )}>
        <ChatWindow />
      </div>

      {/* Contact details: desktop only */}
      {selectedContact && (
        <div className="hidden xl:block">
          <ContactDetails />
        </div>
      )}
    </div>
  );
}
