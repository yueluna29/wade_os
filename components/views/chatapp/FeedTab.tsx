import React from 'react';
import { SocialFeed } from '../SocialFeed';

export const FeedTab: React.FC = () => {
  return (
    <div className="flex-1 min-h-0 overflow-hidden h-full">
      <SocialFeed />
    </div>
  );
};
