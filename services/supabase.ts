
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rxqtmxypndalebtvhlfg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4cXRteHlwbmRhbGVidHZobGZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MzQwMzIsImV4cCI6MjA4NzAxMDAzMn0.AyZqcT5tnrJZlHOGdScJ8RG_mw242IesOhrNBEU_-FE';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export const uploadAvatar = async (file: File, path: string): Promise<string | null> => {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${path}-${Math.random()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file);

    if (uploadError) {
      console.error('Upload Error:', uploadError);
      throw uploadError;
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
    return data.publicUrl;
  } catch (error) {
    console.error("Avatar Upload Failed", error);
    return null;
  }
};
