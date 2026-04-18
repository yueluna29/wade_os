// Kept as a thin shim so any lingering imports keep working.
// New chat-app code lives in components/views/chatapp/.
import React from 'react';
import { ChatAppShell } from './chatapp/ChatAppShell';

export const ChatListView: React.FC = () => <ChatAppShell phoneOwner="luna" />;
