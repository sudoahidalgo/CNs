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

  const response = await fetch(
    `${url}/rest/v1/bares?select=id,nombre,instagram_url,facebook_url,activo&order=nombre`,
    {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
      },
    },
  );

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
      supabase.from('bares').select('id, nombre, instagram_url, facebook_url, activo').order('nombre'),
      supabase.from('usuarios').select('id, nombre').order('nombre'),
      supabase.from('asistencias').select('user_id').eq('semana_id', weekId).eq('confirmado', true)
    ]);

    if (weekRes.error) throw weekRes.error;
    if (usersRes.error) throw usersRes.error;
    if (attendsRes.error) throw attendsRes.error;

    editingWeekId = weekId;

    const barSelect = document.getElementById('editBarSelect');
    let barsData = barsRes.data || [];

    if (barsRes.error) {
      console.warn('Fallo cargando bares con el cliente de Supabase, reintentando con fetch directo.', barsRes.error);
      barsData = await fetchBarsWithHeaders();
    }

    barSelect.innerHTML = (barsData || [])
      .map((b) => `<option value="${b.id}">${b.nombre}</option>`)
      .join('');

    const initialBarId = (() => {
      if (weekRes.data?.bar_id) return String(weekRes.data.bar_id);
      if (weekRes.data?.bar_ganador) {
        const found = (barsData || []).find((bar) => bar.nombre === weekRes.data.bar_ganador);
        if (found?.id) return String(found.id);
      }
      return '';
    })();

    if (initialBarId) {
      barSelect.value = initialBarId;
    }

    const attendees = new Set((attendsRes.data || []).map(a => a.user_id));
    const usersContainer = document.getElementById('editWeekUsers');
    usersContainer.innerHTML = (usersRes.data || []).map(u => `
      <div class="form-check">
        <input class="form-check-input" type="checkbox" value="${u.id}" id="editUser-${u.id}" ${attendees.has(u.id) ? 'checked' : ''}>
        <label class="form-check-label" for="editUser-${u.id}">${u.nombre}</label>
      </div>
    `).join('');

    const asistentesInput = document.getElementById('editAsistentes');
    if (asistentesInput) {
      const totalAsistentes =
        weekRes.data?.asistentes ??
        weekRes.data?.total_asistentes ??
        attendees.size ??
        '';
      asistentesInput.value = totalAsistentes !== undefined && totalAsistentes !== null ? totalAsistentes : '';
    }

    const modalEl = document.getElementById('editWeekModal');
    if (!modalEl) {
      throw new Error('No se encontró el modal de edición.');
    }

    modalEl.dataset.weekId = String(weekId);

    const modal = new bootstrap.Modal(modalEl);
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
  const modalEl = document.getElementById('editWeekModal');
  if (!modalEl) {
    alert('Faltan datos: week_id o fields');
    return;
  }

  const normalizeId = (value) => {
    if (value === undefined || value === null || value === '') return null;
    const num = Number(value);
    return Number.isNaN(num) || num <= 0 ? null : num;
  };

  const datasetWeekId = modalEl.dataset?.weekId;
  const weekIdFromDataset = normalizeId(datasetWeekId);
  const weekIdFromState = normalizeId(editingWeekId);
  const week_id = weekIdFromDataset || weekIdFromState;

  const barSelect = modalEl?.querySelector('#editBarSelect');
  const asistentesInput = modalEl?.querySelector('#editAsistentes');
  const selected = Array.from(
    modalEl.querySelectorAll('#editWeekUsers input:checked')
  ).map(el => el.value);

  const barId = barSelect && barSelect.value !== '' ? Number(barSelect.value) : null;
  const asistentesRaw = asistentesInput ? asistentesInput.value.trim() : '';
  const asistentesNumber = asistentesRaw === '' ? selected.length : Number(asistentesRaw);
  const asistentes = Number.isNaN(asistentesNumber) ? selected.length : asistentesNumber;

  const attendees = selected.map((value) => {
    const numeric = Number(value);
    return Number.isNaN(numeric) ? value : numeric;
  });

  const fields = {
    bar_id: barId !== null && !Number.isNaN(barId) ? barId : null,
    asistentes,
    attendees,
  };

  if (!week_id || !fields || typeof fields !== 'object') {
    alert('Faltan datos: week_id o fields');
    return;
  }

  const payload = { week_id, fields };

  if (typeof isAdmin !== 'undefined' && !isAdmin) {
    return;
  }

  try {
    const res = await fetch('/.netlify/functions/updateAttendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(`${res.status}: ${data.error || 'Request failed'}`);
    }

    const modalInstance = bootstrap.Modal.getInstance(modalEl);
    if (modalInstance) {
      modalInstance.hide();
    }

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
    if (modalEl) {
      delete modalEl.dataset.weekId;
    }
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
