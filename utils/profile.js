import { supabase } from './supabase';

export async function ensureUserProfile(user, displayName = null) {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name')
      .eq('id', user.id)
      .maybeSingle();

    if (!data) {
      const { error } = await supabase.from('profiles').insert({
        id: user.id,
        email: user.email,
        role: 'app_user',
        display_name: displayName || null,
      });
      if (error) console.log('[Profile] insert error:', error.message);
      else console.log('[Profile] created for', user.id);
      return;
    }

    if (displayName && !data.display_name) {
      const { error } = await supabase
        .from('profiles')
        .update({ display_name: displayName })
        .eq('id', user.id);
      if (error) console.log('[Profile] update error:', error.message);
    }
  } catch (e) {
    console.log('[Profile] ensureUserProfile error:', e?.message);
  }
}
