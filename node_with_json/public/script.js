// ===== GERENCIAMENTO DE INTERFACE =====
document.addEventListener('DOMContentLoaded', () => {
  // Carrega bancos disponíveis ao iniciar
  loadDatabases();

  // Adiciona primeiro campo
  addFieldRow();

  // Configura navegação
  setupSidebar();

  // Configura eventos dos formulários
  setupForms();
});

function setupSidebar() {
  // Navegação entre abas
  document.querySelectorAll('.sidebar a').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.getElementById(link.getAttribute('data-target'));
      document.querySelectorAll('.card').forEach(card => card.classList.remove('active'));
      target.classList.add('active');

      // Recarrega dados quando acessar certas abas
      if (['create-table', 'insert-record', 'list-records'].includes(link.getAttribute('data-target'))) {
        loadDatabases();
      }
    });
  });

  // Toggle da sidebar
  const sidebar = document.querySelector('.sidebar');
  document.getElementById('sidebar-toggle').addEventListener('click', (e) => {
    e.stopPropagation();
    sidebar.classList.toggle('collapsed');
  });
}

function setupForms() {
  // Formulário de criar banco
  document.getElementById('create-db-form').addEventListener('submit', handleCreateDatabase);

  // Formulário de criar tabela
  document.getElementById('create-table-form').addEventListener('submit', handleCreateTable);
  document.getElementById('add-field').addEventListener('click', () => addFieldRow());

  // Formulário de inserir registro
  document.getElementById('insert-record-form').addEventListener('submit', handleInsertRecord);
  document.getElementById('insert-db-name').addEventListener('change', loadTablesForInsert);

  // Formulário de listar registros
  document.getElementById('list-records-form').addEventListener('submit', handleListRecords);
  document.getElementById('list-db-name').addEventListener('change', loadTablesForList);
}

// ===== GERENCIAMENTO DE BANCOS E TABELAS =====
async function loadDatabases() {
  const selects = [
    document.getElementById('db-name-in-table'),
    document.getElementById('insert-db-name'),
    document.getElementById('list-db-name')
  ];

  try {
    const response = await fetch('/list-dbs');
    const data = await response.json();

    selects.forEach(select => {
      // Salva o valor atual para manter a seleção
      const currentValue = select.value;
      select.innerHTML = '<option value="">Selecione um banco</option>';

      if (data.databases && data.databases.length > 0) {
        data.databases.forEach(db => {
          const option = document.createElement('option');
          option.value = db;
          option.textContent = db;
          select.appendChild(option);
        });

        // Restaura a seleção anterior se ainda existir
        if (currentValue && data.databases.includes(currentValue)) {
          select.value = currentValue;
        }
      }
    });
  } catch (error) {
    console.error('Erro ao carregar bancos:', error);
    selects.forEach(select => {
      select.innerHTML = '<option value="">Erro ao carregar</option>';
    });
  }
}

async function loadTables(dbName, targetSelect) {
    targetSelect.disabled = true;
    targetSelect.innerHTML = '<option value="">Carregando tabelas...</option>';

    try {
        const response = await fetch(`/list-tables?db=${encodeURIComponent(dbName)}`);
        if (!response.ok) {
            throw new Error('Erro ao carregar tabelas');
        }

        const data = await response.json();

        // Verifica se a propriedade tables existe
        if (!data.tables) {
            throw new Error('Formato de resposta inválido');
        }

        targetSelect.innerHTML = '';

        if (data.tables.length > 0) {
            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = 'Selecione uma tabela';
            targetSelect.appendChild(defaultOption);

            data.tables.forEach(table => {
                const option = document.createElement('option');
                option.value = table;
                option.textContent = table;
                targetSelect.appendChild(option);
            });
        } else {
            targetSelect.innerHTML = '<option value="">Nenhuma tabela encontrada</option>';
        }

        targetSelect.disabled = false;
    } catch (error) {
        console.error('Erro ao carregar tabelas:', error);
        targetSelect.innerHTML = '<option value="">Erro ao carregar</option>';
        targetSelect.disabled = false;
    }
}

async function loadTableStructure(dbName, tableName) {
  try {
    const response = await fetch(`/table-structure?db=${encodeURIComponent(dbName)}&table=${encodeURIComponent(tableName)}`);
    return await response.json();
  } catch (error) {
    console.error('Erro ao carregar estrutura:', error);
    return null;
  }
}

// ===== FUNÇÕES PARA FORMULÁRIO DE INSERÇÃO =====
async function loadTablesForInsert() {
  const dbName = document.getElementById('insert-db-name').value;
  const tableSelect = document.getElementById('insert-table-name');

  if (dbName) {
    await loadTables(dbName, tableSelect);
    tableSelect.addEventListener('change', loadInsertFields);
  } else {
    tableSelect.innerHTML = '<option value="">Selecione uma tabela</option>';
    tableSelect.disabled = true;
    document.getElementById('insert-fields-container').innerHTML = '';
  }
}

async function loadInsertFields() {
  const dbName = document.getElementById('insert-db-name').value;
  const tableName = document.getElementById('insert-table-name').value;
  const container = document.getElementById('insert-fields-container');

  if (!dbName || !tableName) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = '<p>Carregando campos...</p>';

  const structure = await loadTableStructure(dbName, tableName);
  if (!structure || !structure.fields) {
    container.innerHTML = '<p>Erro ao carregar campos</p>';
    return;
  }

  container.innerHTML = '';

  structure.fields.forEach(field => {
    const fieldDiv = document.createElement('div');
    fieldDiv.className = 'insert-field';

    const label = document.createElement('label');
    label.textContent = `${field.name} (${field.type}${field.size ? `(${field.size})` : ''})`;

    let input;
    if (field.type === 'BOOLEAN') {
      input = document.createElement('select');
      input.innerHTML = `
        <option value="true">Verdadeiro</option>
        <option value="false">Falso</option>
      `;
    } else if (field.type === 'DATE' || field.type === 'DATETIME') {
      input = document.createElement('input');
      input.type = 'datetime-local';
    } else {
      input = document.createElement('input');
      input.type = 'text';
    }

    input.required = !field.nullable;
    input.dataset.fieldName = field.name;
    input.dataset.fieldType = field.type;

    fieldDiv.appendChild(label);
    fieldDiv.appendChild(input);
    container.appendChild(fieldDiv);
  });
}

// ===== FUNÇÕES PARA FORMULÁRIO DE LISTAGEM =====
async function loadTablesForList() {
  const dbName = document.getElementById('list-db-name').value;
  const tableSelect = document.getElementById('list-table-name');

  if (dbName) {
    await loadTables(dbName, tableSelect);
  } else {
    tableSelect.innerHTML = '<option value="">Selecione uma tabela</option>';
    tableSelect.disabled = true;
  }
}

// ===== MANIPULAÇÃO DE FORMULÁRIOS =====
async function handleCreateDatabase(e) {
  e.preventDefault();
  const formData = new FormData(e.target);

  try {
    const response = await fetch('/criar-db', {
      method: 'POST',
      body: formData
    });

    if (response.ok) {
      alert('Banco criado com sucesso!');
      e.target.reset();
      await loadDatabases();
    } else {
      const error = await response.json();
      throw new Error(error.message || 'Erro ao criar banco');
    }
  } catch (error) {
    console.error('Erro:', error);
    alert('Falha ao criar banco: ' + error.message);
  }
}

async function handleCreateTable(e) {
  e.preventDefault();

  const dbName = document.getElementById('db-name-in-table').value;
  const tableName = document.getElementById('table-name').value;
  const fieldRows = document.querySelectorAll('.field-row');

  if (!dbName || !tableName || fieldRows.length === 0) {
    alert('Preencha todos os campos e adicione pelo menos um campo na tabela!');
    return;
  }

  // Coletar definições dos campos
  const fields = [];
  let hasPrimaryKey = false;

  fieldRows.forEach(row => {
    const fieldName = row.querySelector('input[type="text"]').value.trim();
    if (!fieldName) return;

    const field = {
      name: fieldName,
      type: row.querySelector('.field-type').value,
      size: row.querySelector('.field-size').disabled ? null : row.querySelector('.field-size').value,
      primary: row.querySelector('.field-primary').checked,
      nullable: row.querySelector('.field-nullable').checked
    };

    if (field.primary) hasPrimaryKey = true;
    fields.push(field);
  });

  if (fields.length === 0) {
    alert('Adicione pelo menos um campo válido!');
    return;
  }

  if (!hasPrimaryKey && !confirm('ATENÇÃO: Nenhum campo foi marcado como chave primária. Deseja continuar mesmo assim?')) {
    return;
  }

  try {
    const response = await fetch('/create-table', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dbName, tableName, fields })
    });

    const result = await response.json();

    if (result.success) {
      alert(`Tabela "${tableName}" criada com sucesso no banco "${dbName}"!`);
      document.getElementById('table-name').value = '';
      document.getElementById('fields-container').innerHTML = '';
      addFieldRow();
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('Erro:', error);
    alert(`Falha ao criar tabela: ${error.message}`);
  }
}

async function handleInsertRecord(e) {
  e.preventDefault();

  const dbName = document.getElementById('insert-db-name').value;
  const tableName = document.getElementById('insert-table-name').value;

  if (!dbName || !tableName) {
    alert('Selecione um banco e uma tabela!');
    return;
  }

  const inputs = document.querySelectorAll('#insert-fields-container input, #insert-fields-container select');
  const record = {};

  inputs.forEach(input => {
    let value = input.value;

    // Conversão de tipos
    if (input.dataset.fieldType === 'INT') {
      value = parseInt(value) || 0;
    } else if (input.dataset.fieldType === 'FLOAT') {
      value = parseFloat(value) || 0.0;
    } else if (input.dataset.fieldType === 'BOOLEAN') {
      value = value === 'true';
    } else if (input.dataset.fieldType === 'DATE' || input.dataset.fieldType === 'DATETIME') {
      value = new Date(value).toISOString();
    }

    record[input.dataset.fieldName] = value;
  });

  try {
    const response = await fetch('/insert-record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dbName, tableName, record })
    });

    const result = await response.json();

    if (result.success) {
      alert('Registro inserido com sucesso!');
      // Limpa os campos
      inputs.forEach(input => {
        if (input.tagName === 'INPUT') {
          input.value = '';
        } else if (input.tagName === 'SELECT') {
          input.selectedIndex = 0;
        }
      });
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('Erro:', error);
    alert(`Falha ao inserir registro: ${error.message}`);
  }
}

async function handleListRecords(e) {
  e.preventDefault();

  const dbName = document.getElementById('list-db-name').value;
  const tableName = document.getElementById('list-table-name').value;
  const outputDiv = document.getElementById('records-output');

  if (!dbName || !tableName) {
    alert('Selecione um banco e uma tabela!');
    return;
  }

  outputDiv.innerHTML = '<p>Carregando registros...</p>';

  try {
    const response = await fetch(`/list-records?db=${encodeURIComponent(dbName)}&table=${encodeURIComponent(tableName)}`);
    const result = await response.json();

    if (result.success) {
      if (result.records && result.records.length > 0) {
        renderRecordsTable(result.records, result.fields);
      } else {
        outputDiv.innerHTML = '<p>Nenhum registro encontrado</p>';
      }
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('Erro:', error);
    outputDiv.innerHTML = `<p>Erro ao carregar registros: ${error.message}</p>`;
  }
}

function renderRecordsTable(records, fields) {
  const outputDiv = document.getElementById('records-output');

  const table = document.createElement('table');
  table.className = 'record-table';

  // Cabeçalho
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');

  fields.forEach(field => {
    const th = document.createElement('th');
    th.textContent = field.name;
    headerRow.appendChild(th);
  });

  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Corpo
  const tbody = document.createElement('tbody');

  records.forEach(record => {
    const row = document.createElement('tr');

    fields.forEach(field => {
      const td = document.createElement('td');
      let value = record[field.name];

      if (value === null || value === undefined) {
        value = 'NULL';
      } else if (typeof value === 'boolean') {
        value = value ? 'Verdadeiro' : 'Falso';
      } else if (field.type === 'DATE' || field.type === 'DATETIME') {
        value = new Date(value).toLocaleString();
      }

      td.textContent = value;
      row.appendChild(td);
    });

    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  outputDiv.innerHTML = '';
  outputDiv.appendChild(table);
}

// ===== GERENCIAMENTO DE CAMPOS DA TABELA =====
function addFieldRow(field = { name: '', type: 'VARCHAR', size: 255, primary: false, nullable: true }) {
  const container = document.getElementById('fields-container');
  const fieldId = Date.now();

  const fieldHTML = `
    <div class="field-row" data-id="${fieldId}">
      <input type="text" placeholder="Nome do campo" value="${field.name}" required>
      
      <select class="field-type">
        <option value="INT" ${field.type === 'INT' ? 'selected' : ''}>INT</option>
        <option value="VARCHAR" ${field.type === 'VARCHAR' ? 'selected' : ''}>VARCHAR</option>
        <option value="TEXT" ${field.type === 'TEXT' ? 'selected' : ''}>TEXT</option>
        <option value="DATE" ${field.type === 'DATE' ? 'selected' : ''}>DATE</option>
        <option value="DATETIME" ${field.type === 'DATETIME' ? 'selected' : ''}>DATETIME</option>
        <option value="BOOLEAN" ${field.type === 'BOOLEAN' ? 'selected' : ''}>BOOLEAN</option>
        <option value="FLOAT" ${field.type === 'FLOAT' ? 'selected' : ''}>FLOAT</option>
      </select>
      
      <input type="number" class="field-size" value="${field.size}" 
             ${['INT', 'DATE', 'DATETIME', 'BOOLEAN'].includes(field.type) ? 'disabled' : ''}>
      
      <label>
        <input type="checkbox" class="field-primary" ${field.primary ? 'checked' : ''}>
        PK
      </label>
      
      <label>
        <input type="checkbox" class="field-nullable" ${field.nullable ? 'checked' : ''}>
        NULL
      </label>
      
      <button type="button" class="remove-field">×</button>
    </div>
  `;

  container.insertAdjacentHTML('beforeend', fieldHTML);

  // Atualiza o estado do campo size quando o tipo muda
  container.querySelector(`[data-id="${fieldId}"] .field-type`).addEventListener('change', (e) => {
    const sizeInput = e.target.closest('.field-row').querySelector('.field-size');
    sizeInput.disabled = ['INT', 'DATE', 'DATETIME', 'BOOLEAN'].includes(e.target.value);
    if (sizeInput.disabled) sizeInput.value = '';
  });

  // Remove campo
  container.querySelector(`[data-id="${fieldId}"] .remove-field`).addEventListener('click', (e) => {
    e.target.closest('.field-row').remove();
  });
}

async function handleListRecords(e) {
    e.preventDefault();

    const dbName = document.getElementById('list-db-name').value;
    const tableName = document.getElementById('list-table-name').value;
    const outputDiv = document.getElementById('records-output');

    if (!dbName || !tableName) {
        alert('Selecione um banco e uma tabela!');
        return;
    }

    outputDiv.innerHTML = '<div class="loading-message">Carregando registros...</div>';

    try {
        const response = await fetch(`/list-records?db=${encodeURIComponent(dbName)}&table=${encodeURIComponent(tableName)}`);
        const result = await response.json();

        if (result.success) {
            if (result.count > 0) {
                renderRecordsTable(result.records, result.fields);
            } else {
                outputDiv.innerHTML = '<div class="info-message">Nenhum registro encontrado</div>';
            }

            // Adiciona contador de registros
            const countElement = document.createElement('div');
            countElement.className = 'record-count';
            countElement.textContent = `Total de registros: ${result.count}`;
            outputDiv.prepend(countElement);
        } else {
            throw new Error(result.message || 'Erro ao carregar registros');
        }
    } catch (error) {
        console.error('Erro:', error);
        outputDiv.innerHTML = `<div class="error-message">Erro ao carregar registros: ${error.message}</div>`;
    }
}

function renderRecordsTable(records, fields) {
    const outputDiv = document.getElementById('records-output');
    outputDiv.innerHTML = '';

    // Cria a tabela
    const table = document.createElement('table');
    table.className = 'record-table';

    // Cria o cabeçalho
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');

    fields.forEach(field => {
        const th = document.createElement('th');
        th.textContent = field.name;
        th.title = `${field.type}${field.size ? `(${field.size})` : ''} ${field.primary ? '| PK' : ''} ${field.nullable ? '| NULL' : '| NOT NULL'}`;
        headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Cria o corpo da tabela
    const tbody = document.createElement('tbody');

    records.forEach(record => {
        const row = document.createElement('tr');

        fields.forEach(field => {
            const td = document.createElement('td');
            let value = record[field.name];

            // Formatação especial para diferentes tipos de dados
            if (value === null || value === undefined) {
                value = '<span class="null-value">NULL</span>';
            } else if (typeof value === 'boolean') {
                value = value ? '<span class="true-value">✓</span>' : '<span class="false-value">✗</span>';
            } else if (field.type === 'DATE' || field.type === 'DATETIME') {
                value = new Date(value).toLocaleString();
            } else if (typeof value === 'object') {
                value = JSON.stringify(value);
            }

            td.innerHTML = value;
            row.appendChild(td);
        });

        tbody.appendChild(row);
    });

    table.appendChild(tbody);
    outputDiv.appendChild(table);

}