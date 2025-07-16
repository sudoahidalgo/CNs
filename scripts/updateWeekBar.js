const { createClient } = require('@supabase/supabase-js');

async function main(dateStr, barSearch) {
  if (!dateStr || !barSearch) {
    console.error('Usage: node scripts/updateWeekBar.js <YYYY-MM-DD> <bar substring>');
    process.exit(1);
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data: week, error: weekErr } = await supabase
    .from('semanas_cn')
    .select('id')
    .eq('fecha_martes', dateStr)
    .single();
  if (weekErr) throw weekErr;

  const { data: bar, error: barErr } = await supabase
    .from('bares')
    .select('nombre')
    .ilike('nombre', `%${barSearch}%`)
    .maybeSingle();
  if (barErr) throw barErr;
  if (!bar) throw new Error(`Bar matching "${barSearch}" not found`);

  const { data: attends, error: attErr } = await supabase
    .from('asistencias')
    .select('user_id')
    .eq('semana_id', week.id)
    .eq('confirmado', true);
  if (attErr) throw attErr;
  const attendeeIds = attends.map(a => a.user_id);

  const { error: rpcErr } = await supabase.rpc('update_week_and_visits', {
    week_id: week.id,
    bar: bar.nombre,
    attendees: attendeeIds
  });
  if (rpcErr) throw rpcErr;

  console.log(`Updated week ${dateStr} (id ${week.id}) to bar "${bar.nombre}"`);
}

main(process.argv[2], process.argv[3]).catch(err => {
  console.error('Failed:', err.message);
  process.exit(1);
});
