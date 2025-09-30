let editingWeekId = null;
let supabaseClientOverride = null;

const getSupabaseClient = () => {
  if (supabaseClientOverride) return supabaseClientOverride;

  if (typeof window === 'undefined') {
    return null;
  }

  if (window.supabaseClient && typeof window.supabaseClient.from === 'function') {
    return window.supabaseClient;
  }

  if (window.supabase && typeof window.supabase.from === 'function') {
    window.supabaseClient = window.supabase;
    return window.supabaseClient;
  }

  if (
    window.supabase &&
    typeof window.supabase.createClient === 'function' &&
    window.supabaseUrl &&
    window.supabaseKey
  ) {
    const client = window.supabase.createClient(window.supabaseUrl, window.supabaseKey);
    window.supabaseClient = client;
    return client;
  }

  return null;
};

const fetchBarsWithHeaders = async () => {
  if (typeof window === 'undefined') {
    throw new Error('Supabase REST API requires a browser environment');
  }

  const url = window.supabaseUrl;
  const anonKey = window.supabaseKey;

  if (!url || !anonKey) {
    throw new Error('Supabase configuration missing. Please define supabaseUrl and supabaseKey.');
  }

  const response = await fetch(`${url}/rest/v1/bares?select=nombre&order=nombre`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to load bars (${response.status}): ${errorText || 'Unknown error'}`);
  }

  return response.json();
};

async function openEditWeek(weekId) {
  try {
    const supabase = getSupabaseClient();

    if (!supabase) {
      throw new Error('Supabase client no está inicializado.');
    }

    const [weekRes, barsRes, usersRes, attendsRes] = await Promise.all([
      supabase.from('semanas_cn').select('*').eq('id', weekId).single(),
      supabase.from('bares').select('nombre').order('nombre'),
      supabase.from('usuarios').select('id, nombre').order('nombre'),
      supabase.from('asistencias').select('user_id').eq('semana_id', weekId).eq('confirmado', true)
    ]);

    if (weekRes.error) throw weekRes.error;
    if (usersRes.error) throw usersRes.error;
    if (attendsRes.error) throw attendsRes.error;

    editingWeekId = weekId;

    const barSelect = document.getElementById('editWeekBar');
    let barsData = barsRes.data || [];

    if (barsRes.error) {
      console.warn('Fallo cargando bares con el cliente de Supabase, reintentando con fetch directo.', barsRes.error);
      barsData = await fetchBarsWithHeaders();
    }

    barSelect.innerHTML = (barsData || []).map(b => `<option value="${b.nombre}">${b.nombre}</option>`).join('');
    if (weekRes.data?.bar_ganador) {
      barSelect.value = weekRes.data.bar_ganador;
    }

    const attendees = new Set((attendsRes.data || []).map(a => a.user_id));
    const usersContainer = document.getElementById('editWeekUsers');
    usersContainer.innerHTML = (usersRes.data || []).map(u => `
      <div class="form-check">
        <input class="form-check-input" type="checkbox" value="${u.id}" id="editUser-${u.id}" ${attendees.has(u.id) ? 'checked' : ''}>
        <label class="form-check-label" for="editUser-${u.id}">${u.nombre}</label>
      </div>
    `).join('');

    const modal = new bootstrap.Modal(document.getElementById('editWeekModal'));
    modal.show();
  } catch (error) {
    if (window.showAlert) {
      window.showAlert('Error cargando datos de la semana: ' + error.message, 'danger');
    } else {
      alert('Error cargando datos de la semana: ' + error.message);
    }
  }
}

async function saveWeekChanges() {
  if (!editingWeekId) return;

  const bar = document.getElementById('editWeekBar').value || null;
  const selected = Array.from(
    document.querySelectorAll('#editWeekUsers input:checked')
  ).map(el => el.value);

  if (typeof isAdmin !== 'undefined' && !isAdmin) {
    return;
  }

  try {
    const res = await fetch('/.netlify/functions/updateAttendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        weekId: editingWeekId,
        bar,
        attendees: selected,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(`${res.status}: ${data.error || 'Request failed'}`);
    }

    const modal = bootstrap.Modal.getInstance(document.getElementById('editWeekModal'));
    modal.hide();

    if (window.showAlert) {
      window.showAlert('Semana actualizada exitosamente', 'success');
    } else {
      alert('Semana actualizada exitosamente');
    }

    if (typeof loadDashboard === 'function') {
      await loadDashboard();
    } else if (typeof loadDesktopStats === 'function') {
      await loadDesktopStats();
      if (typeof loadVotingData === 'function') {
        await loadVotingData();
      }
    }
  } catch (error) {
    if (window.showAlert) {
      window.showAlert('Error actualizando semana: ' + error.message, 'danger');
    } else {
      alert('Error actualizando semana: ' + error.message);
    }
  } finally {
    editingWeekId = null;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('saveWeekChanges');
  if (btn) btn.addEventListener('click', saveWeekChanges);
});

// Export for testing in Node environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    openEditWeek,
    saveWeekChanges,
    _setEditingWeekId: (id) => { editingWeekId = id; },
    _getEditingWeekId: () => editingWeekId,
    _setSupabaseClient: (client) => { supabaseClientOverride = client; },
  };
}
