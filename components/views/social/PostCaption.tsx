import React from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

interface PostCaptionProps {
  content: string;
  authorName: string;
  hideAuthor?: boolean;
  isDetail?: boolean;
  isExpanded?: boolean;
  className?: string;
}

export const PostCaption: React.FC<PostCaptionProps> = ({ content, authorName, hideAuthor, isDetail = false, isExpanded = false, className }) => {
  const needsShowMore = (content.length > 150 || content.split('\n').length > 5);
  const shouldClamp = !isDetail && !isExpanded && needsShowMore;

  let displayContent = content.replace(/(#[a-zA-Z0-9_\u4e00-\u9fa5]+)/g, '[$1]($1)');
  const processedContent = hideAuthor ? displayContent : `**${authorName}** ` + displayContent;

  return (
    <div className={`text-[15px] text-wade-text-main leading-5 whitespace-normal ${className || ''}`}>
      <div className={shouldClamp ? "line-clamp-4 break-words inline-block w-full" : "break-words inline"}>
        <Markdown 
          remarkPlugins={[remarkGfm, remarkBreaks]} 
          components={{ 
            p: ({children}) => <span className="inline">{children}</span>,
            strong: ({children}) => <span className="font-bold text-wade-text-main mr-1">{children}</span>, 
            a: ({children}) => <span className="text-wade-accent cursor-pointer hover:underline">{children}</span>
          }}
        >
          {processedContent}
        </Markdown>
      </div>
      
      {shouldClamp && (
        <div className="mt-0.5">
           <span className="text-[#1d9bf0] text-[15px] hover:underline cursor-pointer inline-block">
             Show more
           </span>
        </div>
      )}
    </div>
  );
};
