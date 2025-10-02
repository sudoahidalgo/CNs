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

    const supportsBarIdColumn = Object.prototype.hasOwnProperty.call(weekRes.data || {}, 'bar_id');

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
        <input class="form-check-input chk-usuario" type="checkbox" value="${u.id}" id="editUser-${u.id}" ${attendees.has(u.id) ? 'checked' : ''}>
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
    modalEl.dataset.supportsBarId = supportsBarIdColumn ? '1' : '0';

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

  const week_id = Number(modalEl.dataset?.weekId);

  if (!Number.isFinite(week_id) || week_id <= 0) {
    alert('Faltan datos: week_id o fields');
    return;
  }

  const barSelect = document.getElementById('editBarSelect');
  const bar_id = barSelect ? Number(barSelect.value) || null : null;

  const set_user_ids = Array.from(document.querySelectorAll('.chk-usuario:checked')).map((el) => el.value);

  const supportsBarId = modalEl.dataset?.supportsBarId === '1';

  const selectedOption = barSelect?.selectedOptions?.[0] || null;
  const bar_nombre = selectedOption ? selectedOption.textContent.trim() : null;

  const asistentesInput = document.getElementById('editAsistentes');
  const asistentesRaw = asistentesInput ? asistentesInput.value : '';
  let totalAsistentes = Number.parseInt(asistentesRaw, 10);
  if (
    asistentesRaw === '' ||
    Number.isNaN(totalAsistentes) ||
    !Number.isFinite(totalAsistentes) ||
    totalAsistentes < 0
  ) {
    totalAsistentes = set_user_ids.length;
  }

  const huboQuorum = totalAsistentes > 0;
  const totalVotos = totalAsistentes;

  const updatePayload = {};
  if (supportsBarId && bar_id != null) updatePayload.bar_id = bar_id;
  if (bar_nombre) updatePayload.bar_ganador = bar_nombre;
  if (Number.isFinite(totalAsistentes)) updatePayload.total_asistentes = totalAsistentes;
  if (Number.isFinite(totalVotos)) updatePayload.total_votos = totalVotos;
  updatePayload.hubo_quorum = huboQuorum;

  if (typeof isAdmin !== 'undefined' && !isAdmin) {
    return;
  }

  try {
    const supabase = getSupabaseClient();

    if (!supabase) {
      throw new Error('Supabase client no está inicializado.');
    }

    const { error: deleteError } = await supabase
      .from('asistencias')
      .delete()
      .eq('semana_id', week_id);
    if (deleteError) {
      throw new Error('No se pudieron limpiar las asistencias: ' + deleteError.message);
    }

    if (set_user_ids.length > 0) {
      const rows = set_user_ids.map((userId) => ({
        user_id: userId,
        semana_id: week_id,
        confirmado: true,
      }));

      const { error: insertError } = await supabase.from('asistencias').insert(rows);
      if (insertError) {
        throw new Error('No se pudieron guardar las asistencias: ' + insertError.message);
      }
    }

    if (bar_nombre) {
      const { error: visitasError } = await supabase
        .from('visitas_bares')
        .update({ bar: bar_nombre })
        .eq('semana_id', week_id);
      if (visitasError) {
        throw new Error('No se pudo actualizar el historial de visitas: ' + visitasError.message);
      }
    }

    if (Object.keys(updatePayload).length > 0) {
      const { error: updateError } = await supabase
        .from('semanas_cn')
        .update(updatePayload)
        .eq('id', week_id);
      if (updateError) {
        throw new Error('No se pudo actualizar la semana: ' + updateError.message);
      }
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
