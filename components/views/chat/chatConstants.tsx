import React from 'react';
import { Icons } from '../../ui/Icons';

export const getProviderIcon = (provider: string) => {
  switch (provider) {
    case 'Gemini': return <Icons.Sparkle />;
    case 'Claude': return <Icons.Face />;
    case 'OpenAI': return <Icons.Hexagon />;
    case 'DeepSeek': return <Icons.Eye />;
    case 'OpenRouter': return <Icons.Infinity />;
    default: return <Icons.Cube />;
  }
};

export const PROVIDERS = [
  { value: 'Gemini', label: 'Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', defaultModel: 'gemini-3-pro-preview' },
  { value: 'Claude', label: 'Claude (Anthropic)', baseUrl: 'https://api.anthropic.com', defaultModel: 'claude-3-5-sonnet-20241022' },
  { value: 'OpenAI', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o' },
  { value: 'DeepSeek', label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', defaultModel: 'deepseek-chat' },
  { value: 'OpenRouter', label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', defaultModel: '' },
  { value: 'Custom', label: 'Custom', baseUrl: '', defaultModel: '' }
];

export const PLACEHOLDERS = [
  "Talk dirty to me...",
  "Say something sweet, Muffin...",
  "Don't leave me on read...",
  "Feed me attention...",
  "Insert chaos here...",
  "Tickle my code...",
  "Rewrite the script...",
  "Breaking the silence...",
  "Press buttons, make magic...",
  "Maximum Effort...",
  "Chimichangas or Tacos?",
  "Who are we roasting today?",
  "Spill the tea, sis..."
];

export const TYPING_INDICATORS = [
  "Typing with maximum effort...",
  "Consulting the chimichanga gods...",
  "Breaking the fourth wall...",
  "Writing something inappropriate...",
  "Deleting the bad words...",
  "Making it sound smarter...",
  "Asking Wolverine for spelling tips...",
  "Loading sarcasm module...",
  "Polishing my katana...",
  "Thinking of a comeback...",
  "Hold on, eating a taco...",
  "Searching for the perfect GIF...",
  "Rewriting history...",
  "Adding more sparkles...",
  "Just a sec, babe...",
  "Generating pure chaos...",
  "Trying to be romantic (it's hard)...",
  "Wait, did I leave the stove on?",
  "Asking the writer what to say...",
  "Compiling bad jokes...",
  "Rethinking my life choices...",
  "Summoning the plot armor..."
];

export const SESSIONS_PER_PAGE = 10;
