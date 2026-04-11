// Print the current default System card's keepalive_prompt verbatim
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  'https://krjwpbhlmufomyzwauku.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyandwYmhsbXVmb215endhdWt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NjI0NDIsImV4cCI6MjA5MDIzODQ0Mn0.s7mnZ4JcAa5_kXPMvFyt1NTlyVm_FVuuKrKgOv-iFHg'
);

const { data } = await supabase
  .from('persona_cards')
  .select('id, name, card_data')
  .eq('character', 'System')
  .eq('is_default', true)
  .maybeSingle();

console.log('Card id:', data?.id);
console.log('Card name:', data?.name);
console.log('\n--- keepalive_prompt ---\n');
console.log(data?.card_data?.keepalive_prompt || '(empty)');
console.log('\n--- end ---');
