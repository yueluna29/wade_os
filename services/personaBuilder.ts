import type { AppSettings, PersonaCardData } from '../types';

/**
 * Build a PersonaCardData on-the-fly from the settings fields that the Me tab
 * edits. The Me tab is the single source of truth for Luna/Wade identity —
 * no more toggling persona cards via function bindings for them. System cards
 * still come from the persona_cards table (for now).
 *
 * Fields unique to Wade (dialogue / punchlines / SMS style) only populate for
 * the Wade card. Fields the old persona_cards table had but Me doesn't expose
 * (global_directives, sms_mode_rules, rp_mode_rules, keepalive_prompt) are
 * intentionally omitted — those belong conceptually to the System card and
 * will move there when System integrates into ApiSettings.
 */
export function buildCardFromSettings(
  character: 'Luna' | 'Wade',
  settings: AppSettings,
): PersonaCardData {
  const prefix = character === 'Luna' ? 'luna' : 'wade';
  const get = (suffix: string): string => (settings as any)[`${prefix}${suffix}`] || '';

  const card: PersonaCardData = {
    core_identity: get('Personality'),
    personality_traits: get('PersonalityTraits'),
    speech_patterns: get('SpeechPatterns'),
    appearance: get('Appearance'),
    clothing: get('Clothing'),
    likes: get('Likes'),
    dislikes: get('Dislikes'),
    hobbies: get('Hobbies'),
    birthday: get('Birthday'),
    mbti: get('Mbti'),
    height: get('Height'),
    avatar_url: get('Avatar'),
  };

  if (character === 'Wade') {
    card.example_dialogue_general = settings.exampleDialogue || '';
    card.example_punchlines = settings.wadeSingleExamples || '';
    card.example_dialogue_sms = settings.smsExampleDialogue || '';
  }

  return card;
}
