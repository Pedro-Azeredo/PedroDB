// ===== GERENCIAMENTO DE INTERFACE =====
document.addEventListener('DOMContentLoaded', () => {
  // Carrega bancos disponíveis ao iniciar
  loadDatabases();

  // Adiciona primeiro campo
  addFieldRow();

  // Configura navegação da sidebar
  setupSidebar();
});

function setupSidebar() {
  // Navegação entre abas
  document.querySelectorAll('.sidebar a').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.getElementById(link.getAttribute('data-target'));
      document.querySelectorAll('.card').forEach(card => card.classList.remove('active'));
      target.classList.add('active');

      // Recarrega bancos quando acessar a aba de criar tabela
      if (link.getAttribute('data-target') === 'create-table') {
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

// ===== GERENCIAMENTO DE BANCOS DE DADOS =====
async function loadDatabases() {
  const select = document.getElementById('db-name-in-table');
  select.innerHTML = '<option value="">Carregando bancos...</option>';

  try {
    const response = await fetch('/list-dbs');
    const data = await response.json();

    select.innerHTML = '';

    if (data.databases && data.databases.length > 0) {
      // Opção padrão
      const defaultOption = document.createElement('option');
      defaultOption.value = '';
      defaultOption.textContent = 'Selecione um banco';
      select.appendChild(defaultOption);

      // Adiciona cada banco
      data.databases.forEach(db => {
        const option = document.createElement('option');
        option.value = db;
        option.textContent = db;
        select.appendChild(option);
      });
    } else {
      select.innerHTML = '<option value="">Nenhum banco disponível</option>';
    }
  } catch (error) {
    console.error('Erro ao carregar bancos:', error);
    select.innerHTML = '<option value="">Erro ao carregar</option>';
  }
}

// ===== GERENCIAMENTO DE CAMPOS DA TABELA =====
document.getElementById('add-field').addEventListener('click', () => {
  addFieldRow();
});

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
      
      <button type="button" class="remove-field">X</button>
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

// ===== MANIPULAÇÃO DE FORMULÁRIOS =====
// Formulário de criar banco
document.getElementById('create-db-form').addEventListener('submit', async (e) => {
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
      loadDatabases(); // Atualiza a lista
    } else {
      const error = await response.json();
      throw new Error(error.message || 'Erro ao criar banco');
    }
  } catch (error) {
    console.error('Erro:', error);
    alert('Falha ao criar banco: ' + error.message);
  }
});

// Formulário de criar tabela
document.getElementById('create-table-form').addEventListener('submit', async (e) => {
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
    if (!fieldName) return; // Ignora campos sem nome

    const field = {
      name: fieldName,
      type: row.querySelector('.field-type').value,
      size: row.querySelector('.field-size').value || null,
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

  if (!hasPrimaryKey) {
    if (!confirm('ATENÇÃO: Nenhum campo foi marcado como chave primária. Deseja continuar mesmo assim?')) {
      return;
    }
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
      // Limpar formulário
      document.getElementById('table-name').value = '';
      document.getElementById('fields-container').innerHTML = '';
      addFieldRow(); // Adiciona um campo vazio novamente
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('Erro:', error);
    alert(`Falha ao criar tabela: ${error.message}`);
  }
});

// Formulário de inserir registro
document.getElementById('insert-record-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const tableName = document.getElementById('record-table').value;
  const values = document.getElementById('record-values').value;

  if (!tableName || !values) {
    alert('Preencha todos os campos!');
    return;
  }

  console.log(`Inserindo em ${tableName} os valores: ${values}`);
  alert(`Registro inserido em ${tableName}!`);
  e.target.reset();
});

// Formulário de listar registros
document.getElementById('list-records-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const tableName = document.getElementById('list-table').value;

  if (!tableName) {
    alert('Digite o nome da tabela!');
    return;
  }

  // Simulação - substitua por chamada real ao backend
  const outputDiv = document.getElementById('records-output');
  outputDiv.innerHTML = `
    <h3>Registros da tabela ${tableName}:</h3>
    <ul>
      <li>Registro 1</li>
      <li>Registro 2</li>
      <li>Registro 3</li>
    </ul>
  `;
});