/** @jest-environment jsdom */
const { saveWeekChanges, _setEditingWeekId, _getEditingWeekId } = require('../weekEdit');

describe('saveWeekChanges', () => {
  let updateEqMock, deleteEqMock, insertMock, hideMock;

  beforeEach(() => {
    document.body.innerHTML = `
      <select id="editWeekBar"><option value="Bar1">Bar1</option></select>
      <div id="editWeekUsers">
        <input type="checkbox" value="u1" checked>
        <input type="checkbox" value="u2">
      </div>
      <div id="editWeekModal"></div>
    `;

    hideMock = jest.fn();
    global.bootstrap = {
      Modal: {
        getInstance: jest.fn(() => ({ hide: hideMock }))
      }
    };

    updateEqMock = jest.fn().mockResolvedValue({ error: null });
    const updateMock = jest.fn(() => ({ eq: updateEqMock }));
    deleteEqMock = jest.fn().mockResolvedValue({ error: null });
    const deleteMock = jest.fn(() => ({ eq: deleteEqMock }));
    insertMock = jest.fn().mockResolvedValue({ error: null });

    global.supabase = {
      from: jest.fn((table) => {
        if (table === 'semanas_cn') {
          return { update: updateMock };
        }
        if (table === 'asistencias') {
          return { delete: deleteMock, insert: insertMock };
        }
        return {};
      })
    };

    global.showAlert = jest.fn();

    _setEditingWeekId(1);
  });

  afterEach(() => {
    delete global.supabase;
    delete global.bootstrap;
    delete global.showAlert;
  });

  test('updates week and attendees then resets editingWeekId', async () => {
    await saveWeekChanges();

    expect(global.supabase.from).toHaveBeenCalledWith('semanas_cn');
    expect(updateEqMock).toHaveBeenCalledWith('id', 1);

    expect(global.supabase.from).toHaveBeenCalledWith('asistencias');
    expect(deleteEqMock).toHaveBeenCalledWith('semana_id', 1);

    expect(insertMock).toHaveBeenCalledWith([
      { user_id: 'u1', semana_id: 1, confirmado: true }
    ]);

    expect(hideMock).toHaveBeenCalled();
    expect(_getEditingWeekId()).toBeNull();
  });
});
