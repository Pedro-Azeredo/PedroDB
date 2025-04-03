// ============== CONSTANTES ==============
const SELECTORS = {
  sidebarToggle: '#sidebar-toggle',
  sidebar: '.sidebar',
  databaseSelects: ['#db-name-in-table', '#insert-db-name', '#list-db-name'],
  tableSelects: {
    insert: '#insert-table-name',
    list: '#list-table-name'
  },
  forms: {
    createDb: '#create-db-form',
    createTable: '#create-table-form',
    insertRecord: '#insert-record-form',
    listRecords: '#list-records-form'
  },
  containers: {
    fields: '#fields-container',
    insertFields: '#insert-fields-container',
    recordsOutput: '#records-output'
  },
  buttons: {
    addField: '#add-field'
  }
};

// ============== INICIALIZAÇÃO ==============
document.addEventListener('DOMContentLoaded', () => {
  initializeApplication();
});

async function initializeApplication() {
  try {
    await loadDatabases();
    addFieldRow();
    setupSidebarNavigation();
    setupFormEventListeners();
    setupDatabaseChangeListeners();
  } catch (error) {
    console.error('Erro na inicialização:', error);
  }
}

// ============== NAVEGAÇÃO ==============
function setupSidebarNavigation() {
  const sidebar = document.querySelector(SELECTORS.sidebar);
  const toggleBtn = document.querySelector(SELECTORS.sidebarToggle);

  // Navegação entre abas
  document.querySelectorAll('.sidebar a').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = link.getAttribute('data-target');
      switchActiveCard(targetId);
    });
  });

  // Toggle da sidebar
  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    sidebar.classList.toggle('collapsed');
  });
}

function switchActiveCard(targetId) {
  document.querySelectorAll('.card').forEach(card => card.classList.remove('active'));
  document.getElementById(targetId).classList.add('active');
}

// ============== GERENCIAMENTO DE FORMULÁRIOS ==============
function setupFormEventListeners() {
  // Formulário de criar banco
  document.querySelector(SELECTORS.forms.createDb)
    .addEventListener('submit', handleCreateDatabase);

  // Formulário de criar tabela
  document.querySelector(SELECTORS.forms.createTable)
    .addEventListener('submit', handleCreateTable);

  // Botão para adicionar campo
  document.querySelector(SELECTORS.buttons.addField)
    .addEventListener('click', addFieldRow);

  // Formulário de inserir registro
  document.querySelector(SELECTORS.forms.insertRecord)
    .addEventListener('submit', handleInsertRecord);
}

function setupDatabaseChangeListeners() {
  // Quando muda o banco no formulário de inserção
  document.getElementById('insert-db-name').addEventListener('change', async function() {
    const dbName = this.value;
    const tableSelect = document.getElementById('insert-table-name');

    if (!dbName) {
      tableSelect.disabled = true;
      tableSelect.innerHTML = '<option value="">Selecione uma tabela</option>';
      return;
    }

    tableSelect.disabled = true;
    tableSelect.innerHTML = '<option value="">Carregando tabelas...</option>';

    try {
      const tables = await loadTables(dbName);
      tableSelect.innerHTML = tables.length > 0
        ? '<option value="">Selecione uma tabela</option>' +
          tables.map(table => `<option value="${table}">${table}</option>`).join('')
        : '<option value="">Nenhuma tabela encontrada</option>';

      tableSelect.disabled = false;
    } catch (error) {
      console.error('Erro ao carregar tabelas:', error);
      tableSelect.innerHTML = '<option value="">Erro ao carregar</option>';
      tableSelect.disabled = false;
    }
  });

  // Quando muda a tabela no formulário de inserção
  document.getElementById('insert-table-name').addEventListener('change', async function() {
    const dbName = document.getElementById('insert-db-name').value;
    const tableName = this.value;
    const container = document.getElementById('insert-fields-container');

    if (!dbName || !tableName) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = '<p>Carregando campos...</p>';

    try {
      const response = await fetch(`/table-structure?db=${encodeURIComponent(dbName)}&table=${encodeURIComponent(tableName)}`);
      const result = await response.json();

      if (!result.fields) throw new Error('Estrutura inválida');

      renderInsertFields(result.fields);
    } catch (error) {
      console.error('Erro ao carregar campos:', error);
      container.innerHTML = '<p>Erro ao carregar campos</p>';
    }
  });
}

// ============== BANCOS DE DADOS ==============
async function loadDatabases() {
  try {
    const response = await fetch('/list-dbs');
    const { databases } = await response.json();
    updateDatabaseSelects(databases);
  } catch (error) {
    console.error('Erro ao carregar bancos:', error);
    showErrorOnSelects(SELECTORS.databaseSelects, 'Erro ao carregar');
  }
}

function updateDatabaseSelects(databases) {
  SELECTORS.databaseSelects.forEach(selector => {
    const select = document.querySelector(selector);
    const currentValue = select.value;

    select.innerHTML = '<option value="">Selecione um banco</option>';

    databases.forEach(db => {
      const option = document.createElement('option');
      option.value = db;
      option.textContent = db;
      select.appendChild(option);
    });

    if (currentValue && databases.includes(currentValue)) {
      select.value = currentValue;
    }
  });
}

async function loadTables(dbName) {
  try {
    const response = await fetch(`/list-tables?db=${encodeURIComponent(dbName)}`);
    const { tables } = await response.json();
    return tables || [];
  } catch (error) {
    console.error('Erro ao carregar tabelas:', error);
    return [];
  }
}

// ============== CRIAÇÃO DE TABELAS ==============
function addFieldRow() {
  const container = document.getElementById('fields-container');
  const fieldHTML = `
    <div class="field-row">
      <input type="text" class="field-name" placeholder="Nome" required>
      
      <select class="field-type">
        <option value="INT">INT</option>
        <option value="VARCHAR" selected>VARCHAR</option>
        <option value="TEXT">TEXT</option>
        <option value="FLOAT">FLOAT</option>
        <option value="DATE">DATE</option>
        <option value="DATETIME">DATETIME</option>
      </select>
      
      <input type="number" class="field-length" placeholder="Tamanho" value="255">
      
      <label class="pk-label">
        <input type="checkbox" class="field-pk"> PK
      </label>
      
      <label>
        <input type="checkbox" class="field-nullable" checked> NULL
      </label>
      
      <button type="button" class="remove-field">×</button>
    </div>
  `;

  container.insertAdjacentHTML('beforeend', fieldHTML);

  // Configura eventos do novo campo
  const newField = container.lastElementChild;
  newField.querySelector('.field-type').addEventListener('change', function() {
    const lengthInput = this.closest('.field-row').querySelector('.field-length');
    const noLengthTypes = ['INT', 'FLOAT', 'DATE', 'DATETIME', 'TEXT'];
    lengthInput.disabled = noLengthTypes.includes(this.value);
    if (lengthInput.disabled) lengthInput.value = '';
  });

  newField.querySelector('.remove-field').addEventListener('click', function() {
    this.closest('.field-row').remove();
  });
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

  const fields = Array.from(fieldRows).map(row => {
    const name = row.querySelector('.field-name').value;
    const type = row.querySelector('.field-type').value;
    const length = row.querySelector('.field-length').value;
    const isPK = row.querySelector('.field-pk').checked;
    const isNullable = row.querySelector('.field-nullable').checked;

    let fieldDef = `${name} ${type}`;
    if (length && !['INT', 'FLOAT', 'DATE', 'DATETIME', 'TEXT'].includes(type)) {
      fieldDef += `(${length})`;
    }
    if (isPK) fieldDef += ' PRIMARY KEY';
    if (!isNullable) fieldDef += ' NOT NULL';

    return fieldDef;
  }).join(', ');

  try {
    const response = await fetch('/create-table', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `dbName=${encodeURIComponent(dbName)}&tableName=${encodeURIComponent(tableName)}&fields=${encodeURIComponent(fields)}`
    });

    const result = await response.json();
    alert(result.message || result.error);

    if (response.ok) {
      document.getElementById('table-name').value = '';
      document.getElementById('fields-container').innerHTML = '';
      addFieldRow();
    }
  } catch (error) {
    alert('Erro ao conectar com o servidor');
  }
}

// ============== INSERÇÃO DE REGISTROS ==============
function renderInsertFields(fields) {
  const container = document.getElementById('insert-fields-container');
  container.innerHTML = '';

  fields.forEach(field => {
    const fieldDiv = document.createElement('div');
    fieldDiv.className = 'insert-field';

    const label = document.createElement('label');
    label.textContent = `${field.name} (${field.type})`;

    let input;
    if (field.type === 'DATE' || field.type === 'DATETIME') {
      input = document.createElement('input');
      input.type = 'date';
    } else if (field.type === 'INT' || field.type === 'FLOAT') {
      input = document.createElement('input');
      input.type = 'number';
      input.step = field.type === 'FLOAT' ? '0.01' : '1';
    } else {
      input = document.createElement('input');
      input.type = 'text';
    }

    input.dataset.fieldName = field.name;
    input.required = !field.nullable;

    fieldDiv.appendChild(label);
    fieldDiv.appendChild(input);
    container.appendChild(fieldDiv);
  });
}

async function handleInsertRecord(e) {
  e.preventDefault();
  const dbName = document.getElementById('insert-db-name').value;
  const tableName = document.getElementById('insert-table-name').value;

  if (!dbName || !tableName) {
    alert('Selecione um banco e uma tabela!');
    return;
  }

  const data = {};
  document.querySelectorAll('#insert-fields-container .insert-field input').forEach(input => {
    data[input.dataset.fieldName] = input.value;
  });

  try {
    const response = await fetch('/insert-record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `dbName=${encodeURIComponent(dbName)}&tableName=${encodeURIComponent(tableName)}&data=${encodeURIComponent(JSON.stringify(data))}`
    });

    const result = await response.json();
    alert(result.message || result.error);

    if (response.ok) {
      // Limpa os campos após inserção bem-sucedida
      document.querySelectorAll('#insert-fields-container input').forEach(input => {
        input.value = '';
      });
    }
  } catch (error) {
    alert('Erro ao conectar com o servidor');
  }
}

// ============== CRIAÇÃO DE BANCO ==============
async function handleCreateDatabase(e) {
  e.preventDefault();
  const dbName = document.getElementById('db-name').value;

  if (!dbName) {
    alert('Nome do banco é obrigatório!');
    return;
  }

  try {
    const response = await fetch('/create-database', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `dbName=${encodeURIComponent(dbName)}`
    });

    const result = await response.json();
    alert(result.message || result.error);

    if (response.ok) {
      document.getElementById('db-name').value = '';
      await loadDatabases();
    }
  } catch (error) {
    alert('Erro ao conectar com o servidor');
  }
}

// ============== UTILITÁRIOS ==============
function showErrorOnSelects(selectors, message) {
  selectors.forEach(selector => {
    const select = document.querySelector(selector);
    if (select) select.innerHTML = `<option value="">${message}</option>`;
  });
}




//evento para o formulário de listagem
document.querySelector('#list-records-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const dbName = document.getElementById('list-db-name').value;
  const tableName = document.getElementById('list-table-name').value;
  const outputDiv = document.getElementById('records-output');

  if (!dbName || !tableName) {
    outputDiv.innerHTML = '<p class="error">Selecione um banco e uma tabela!</p>';
    return;
  }

  outputDiv.innerHTML = '<p>Carregando registros...</p>';

  try {
    const response = await fetch(`/list-records?db=${encodeURIComponent(dbName)}&table=${encodeURIComponent(tableName)}`);
    const result = await response.json();

    if (!result.success) throw new Error(result.error);

    renderRecords(result.fields, result.records, result.count);
  } catch (error) {
    outputDiv.innerHTML = `<p class="error">Erro: ${error.message}</p>`;
    console.error('Erro ao listar registros:', error);
  }
});

// Função para renderizar os registros
function renderRecords(fields, records, count) {
  const outputDiv = document.getElementById('records-output');
  outputDiv.innerHTML = '';

  // Contador de registros
  const countElement = document.createElement('p');
  countElement.className = 'record-count';
  countElement.textContent = `Total de registros: ${count}`;
  outputDiv.appendChild(countElement);

  if (count === 0) {
    outputDiv.innerHTML += '<p>Nenhum registro encontrado</p>';
    return;
  }

  // Cria a tabela
  const table = document.createElement('table');
  table.className = 'records-table';

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

  // Corpo da tabela
  const tbody = document.createElement('tbody');

  records.forEach(record => {
    const row = document.createElement('tr');

    fields.forEach(field => {
      const td = document.createElement('td');
      td.textContent = record[field.name] !== null ? record[field.name] : 'NULL';
      row.appendChild(td);
    });

    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  outputDiv.appendChild(table);
}

//evento para carregar tabelas na aba de listagem
document.getElementById('list-db-name').addEventListener('change', async function() {
  const dbName = this.value;
  const tableSelect = document.getElementById('list-table-name');

  if (!dbName) {
    tableSelect.disabled = true;
    tableSelect.innerHTML = '<option value="">Selecione uma tabela</option>';
    return;
  }

  tableSelect.disabled = true;
  tableSelect.innerHTML = '<option value="">Carregando tabelas...</option>';

  try {
    const tables = await loadTables(dbName);
    tableSelect.innerHTML = tables.length > 0
      ? '<option value="">Selecione uma tabela</option>' +
        tables.map(table => `<option value="${table}">${table}</option>`).join('')
      : '<option value="">Nenhuma tabela encontrada</option>';

    tableSelect.disabled = false;
  } catch (error) {
    console.error('Erro ao carregar tabelas:', error);
    tableSelect.innerHTML = '<option value="">Erro ao carregar</option>';
    tableSelect.disabled = false;
  }
});