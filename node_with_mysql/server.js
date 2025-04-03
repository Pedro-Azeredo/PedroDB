const http = require('http');
const mysql = require('mysql2');
const url = require('url');
const querystring = require('querystring');
const fs = require('fs');
const path = require('path');

const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: ''
});

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);

  // Rota para criar banco de dados
  if (req.method === 'POST' && parsedUrl.pathname === '/create-database') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      const { dbName } = querystring.parse(body);
      if (!dbName) {
        return respond(res, 400, { error: 'Nome do banco é obrigatório' });
      }
      connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``, (error) => {
        if (error) return respond(res, 500, { error: error.message });
        respond(res, 201, { message: `Banco "${dbName}" criado com sucesso!` });
      });
    });
  }

  // Rota para criar tabela
  else if (req.method === 'POST' && parsedUrl.pathname === '/create-table') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      const { dbName, tableName, fields } = querystring.parse(body);
      if (!dbName || !tableName || !fields) {
        return respond(res, 400, { error: 'Dados incompletos' });
      }
      connection.changeUser({ database: dbName }, (err) => {
        if (err) return respond(res, 500, { error: err.message });
        connection.query(`CREATE TABLE IF NOT EXISTS \`${tableName}\` (${fields})`, (error) => {
          if (error) return respond(res, 500, { error: error.message });
          respond(res, 201, { message: `Tabela "${tableName}" criada com sucesso!` });
        });
      });
    });
  }

  // Rota para listar bancos (usada no frontend)
  else if (req.method === 'GET' && parsedUrl.pathname === '/list-dbs') {
    connection.query('SHOW DATABASES', (error, results) => {
      if (error) return respond(res, 500, { error: error.message });
      const databases = results.map(row => row.Database)
        .filter(db => !['information_schema', 'mysql', 'performance_schema', 'sys'].includes(db));
      respond(res, 200, { databases });
    });
  }

  // Rota para inserir registro
  else if (req.method === 'POST' && parsedUrl.pathname === '/insert-record') {
  let body = '';
  req.on('data', chunk => body += chunk.toString());
  req.on('end', () => {
    const { dbName, tableName, data } = querystring.parse(body);

    if (!dbName || !tableName || !data) {
      return respond(res, 400, { error: 'Dados incompletos' });
    }

    connection.changeUser({ database: dbName }, (err) => {
      if (err) return respond(res, 500, { error: err.message });

      try {
        const parsedData = JSON.parse(data);
        const columns = Object.keys(parsedData).join(', ');
        const values = Object.values(parsedData).map(v => `'${v}'`).join(', ');

        connection.query(`INSERT INTO \`${tableName}\` (${columns}) VALUES (${values})`, (error, results) => {
          if (error) return respond(res, 500, { error: error.message });
          respond(res, 201, {
            message: 'Registro inserido com sucesso!',
            insertedId: results.insertId
          });
        });
      } catch (error) {
        respond(res, 400, { error: 'Formato de dados inválido' });
      }
    });
  });
}

  // Rota para obter estrutura da tabela
  else if (req.method === 'GET' && parsedUrl.pathname === '/table-structure') {
  const { db, table } = parsedUrl.query;

  if (!db || !table) {
    return respond(res, 400, { error: 'Parâmetros faltando' });
  }

  connection.changeUser({ database: db }, (err) => {
    if (err) return respond(res, 500, { error: err.message });

    connection.query(`DESCRIBE \`${table}\``, (error, results) => {
      if (error) return respond(res, 500, { error: error.message });

      const fields = results.map(field => ({
        name: field.Field,
        type: field.Type.split('(')[0].toUpperCase(),
        nullable: field.Null === 'YES',
        key: field.Key
      }));

      respond(res, 200, { fields });
    });
  });
}

  // Rota para listar tabelas de um banco
  else if (req.method === 'GET' && parsedUrl.pathname === '/list-tables') {
  const { db } = parsedUrl.query;

  if (!db) {
    return respond(res, 400, { error: 'Nome do banco é obrigatório' });
  }

  connection.changeUser({ database: db }, (err) => {
    if (err) return respond(res, 500, { error: err.message });

    connection.query('SHOW TABLES', (error, results) => {
      if (error) return respond(res, 500, { error: error.message });

      const tables = results.map(row => row[`Tables_in_${db}`]);
      respond(res, 200, { tables });
    });
  });
}

  // Rota para listar registros
  else if (req.method === 'GET' && parsedUrl.pathname === '/list-records') {
    const { db, table } = parsedUrl.query;

    if (!db || !table) {
      return respond(res, 400, { error: 'Parâmetros faltando' });
    }

    connection.changeUser({ database: db }, (err) => {
      if (err) return respond(res, 500, { error: err.message });

      // Primeiro obtém a estrutura da tabela
      connection.query(`DESCRIBE \`${table}\``, (error, fields) => {
        if (error) return respond(res, 500, { error: error.message });

        // Depois obtém os registros
        connection.query(`SELECT * FROM \`${table}\``, (error, records) => {
          if (error) return respond(res, 500, { error: error.message });

          respond(res, 200, {
            success: true,
            fields: fields.map(f => ({
              name: f.Field,
              type: f.Type.split('(')[0].toUpperCase()
            })),
            records,
            count: records.length
          });
        });
      });
    });
  }


  // Servir arquivos estáticos
  else if (req.method === 'GET') {
    serveStaticFile(req, res);
  }

  // Rota não encontrada
  else {
    respond(res, 404, { error: 'Rota não encontrada' });
  }
  });

function serveStaticFile(req, res) {
  let filePath = path.join(__dirname, req.url === '/' ? '/index.html' : req.url);
  const extname = path.extname(filePath);
  let contentType = 'text/html';

  switch (extname) {
    case '.js': contentType = 'text/javascript'; break;
    case '.css': contentType = 'text/css'; break;
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') respond(res, 404, 'Arquivo não encontrado');
      else respond(res, 500, 'Erro interno do servidor');
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
}

function respond(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

server.listen(3000, () => {
  console.log(`Servidor rodando em http://localhost:3000`);
});