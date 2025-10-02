/** @jest-environment jsdom */
const {
  saveWeekChanges,
  _setEditingWeekId,
  _getEditingWeekId,
  _setSupabaseClient,
} = require('../weekEdit');

describe('saveWeekChanges', () => {
  let hideMock;
  let supabaseMock;
  let semanasUpdateMock;
  let semanasEqMock;
  let asistenciasDeleteMock;
  let asistenciasDeleteEqMock;
  let asistenciasInsertMock;
  let visitasUpdateMock;
  let visitasEqMock;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="editWeekModal" data-week-id="1" data-supports-bar-id="1">
        <select id="editBarSelect"><option value="3">Bar1</option></select>
        <div id="editWeekUsers">
          <input class="chk-usuario" type="checkbox" value="u1" checked>
          <input class="chk-usuario" type="checkbox" value="u2">
        </div>
        <input id="editAsistentes" value="" />
      </div>
    `;

    hideMock = jest.fn();
    global.bootstrap = {
      Modal: {
        getInstance: jest.fn(() => ({ hide: hideMock }))
      }
    };

    semanasEqMock = jest.fn(() => Promise.resolve({ error: null }));
    semanasUpdateMock = jest.fn(() => ({ eq: semanasEqMock }));

    asistenciasDeleteEqMock = jest.fn(() => Promise.resolve({ error: null }));
    asistenciasDeleteMock = jest.fn(() => ({ eq: asistenciasDeleteEqMock }));

    asistenciasInsertMock = jest.fn(() => Promise.resolve({ error: null }));

    visitasEqMock = jest.fn(() => Promise.resolve({ error: null }));
    visitasUpdateMock = jest.fn(() => ({ eq: visitasEqMock }));

    supabaseMock = {
      from: jest.fn((table) => {
        if (table === 'semanas_cn') {
          return { update: semanasUpdateMock };
        }
        if (table === 'asistencias') {
          return {
            delete: asistenciasDeleteMock,
            insert: asistenciasInsertMock,
          };
        }
        if (table === 'visitas_bares') {
          return { update: visitasUpdateMock };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    };

    _setSupabaseClient(supabaseMock);

    global.isAdmin = true;

    global.showAlert = jest.fn();

    _setEditingWeekId(1);
  });

  afterEach(() => {
    _setSupabaseClient(null);
    delete global.isAdmin;
    delete global.bootstrap;
    delete global.showAlert;
  });

  test('updates week and attendees then resets editingWeekId', async () => {
    await saveWeekChanges();

    expect(supabaseMock.from).toHaveBeenCalledWith('asistencias');
    expect(asistenciasDeleteMock).toHaveBeenCalled();
    expect(asistenciasDeleteEqMock).toHaveBeenCalledWith('semana_id', 1);
    expect(asistenciasInsertMock).toHaveBeenCalledWith([
      { user_id: 'u1', semana_id: 1, confirmado: true },
    ]);

    expect(supabaseMock.from).toHaveBeenCalledWith('semanas_cn');
    expect(semanasUpdateMock).toHaveBeenCalledWith({
      bar_id: 3,
      bar_ganador: 'Bar1',
      total_asistentes: 1,
      total_votos: 1,
      hubo_quorum: true,
    });
    expect(semanasEqMock).toHaveBeenCalledWith('id', 1);

    expect(visitasUpdateMock).toHaveBeenCalledWith({ bar: 'Bar1' });
    expect(visitasEqMock).toHaveBeenCalledWith('semana_id', 1);

    expect(hideMock).toHaveBeenCalled();
    expect(_getEditingWeekId()).toBeNull();
  });

  test('falls back to bar_nombre when bar_id column is unavailable', async () => {
    document.getElementById('editWeekModal').dataset.supportsBarId = '0';

    await saveWeekChanges();

    expect(semanasUpdateMock).toHaveBeenCalledWith({
      bar_ganador: 'Bar1',
      total_asistentes: 1,
      total_votos: 1,
      hubo_quorum: true,
    });
  });

  test('shows status code and error message when request fails', async () => {
    semanasEqMock.mockResolvedValueOnce({ error: { message: 'falló' } });

    await saveWeekChanges();

    expect(global.showAlert).toHaveBeenCalledWith(
      'Error actualizando semana: No se pudo actualizar la semana: falló',
      'danger'
    );
    expect(_getEditingWeekId()).toBeNull();
  });
});
