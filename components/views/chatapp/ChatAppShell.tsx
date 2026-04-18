import React, { useEffect, useState } from 'react';
import { Icons } from '../../ui/Icons';
import { Users, Compass, UserRound } from 'lucide-react';
import { useStore } from '../../../store';
import { ChatInterfaceMixed } from '../ChatInterfaceMixed';
import { ChatsTab } from './ChatsTab';
import { ContactsTab } from './ContactsTab';
import { FeedTab } from './FeedTab';
import { MeTab } from './MeTab';
import { PhoneContact, PhoneOwner } from './mockContacts';

type ChatTab = 'chats' | 'contacts' | 'feed' | 'me';

interface ChatAppShellProps {
  phoneOwner: PhoneOwner;
  // Which tab to land on. Lets the phone home-screen route its Persona app
  // straight to 'me', its Feed app to 'feed', etc. — same shell, different
  // entry point. Defaults to the usual Chats list.
  initialTab?: ChatTab;
}

export const ChatAppShell: React.FC<ChatAppShellProps> = ({ phoneOwner, initialTab = 'chats' }) => {
  const { setNavHidden } = useStore();
  const [activeTab, setActiveTab] = useState<ChatTab>(initialTab);
  const [activeContact, setActiveContact] = useState<PhoneContact | null>(null);

  useEffect(() => {
    setNavHidden(true);
    return () => setNavHidden(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Conversation window takes over the whole shell (with its own back button)
  if (activeContact) {
    return (
      <div className={`${phoneOwner === 'wade' ? 'wade-phone' : 'luna-phone'} h-full`}>
        <ChatInterfaceMixed
          contact={activeContact}
          onBack={() => setActiveContact(null)}
          phoneOwner={phoneOwner}
        />
      </div>
    );
  }

  const openChat = (c: PhoneContact) => {
    setActiveTab('chats');
    setActiveContact(c);
  };

  return (
    <div className={`${phoneOwner === 'wade' ? 'wade-phone' : 'luna-phone'} flex flex-col h-full bg-wade-bg-app`}>
      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'chats' && (
          <ChatsTab phoneOwner={phoneOwner} onOpenContact={setActiveContact} />
        )}
        {activeTab === 'contacts' && (
          <ContactsTab phoneOwner={phoneOwner} onOpenChat={openChat} />
        )}
        {activeTab === 'feed' && <FeedTab />}
        {activeTab === 'me' && <MeTab phoneOwner={phoneOwner} />}
      </div>

      {/* Bottom nav (replaces global nav on mobile, coexists on desktop) */}
      <nav className="shrink-0 bg-wade-bg-card border-t border-wade-border/50 flex items-center justify-around px-2 pt-2 pb-3 md:pb-2">
        {([
          { id: 'chats',    label: 'Chats',    Icon: Icons.Chat },
          { id: 'contacts', label: 'Contacts', Icon: Users },
          { id: 'feed',     label: 'Feed',     Icon: Compass },
          { id: 'me',       label: 'Me',       Icon: UserRound },
        ] as { id: ChatTab; label: string; Icon: any }[]).map(({ id, label, Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className="flex flex-col items-center gap-0.5 py-1 px-3 transition-colors"
            >
              <Icon
                className={`w-[22px] h-[22px] ${active ? 'text-wade-accent' : 'text-wade-text-muted/50'}`}
                strokeWidth={active ? 2 : 1.5}
              />
              <span className={`text-[10px] tracking-wide ${active ? 'text-wade-accent font-medium' : 'text-wade-text-muted/60'}`}>
                {label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
