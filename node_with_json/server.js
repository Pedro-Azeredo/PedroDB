import fs from 'fs';
import http from 'http';
import { formidable } from 'formidable';
import path from 'path';
import { fileURLToPath } from 'url';

// Configura caminhos para ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cria a pasta 'databases' se não existir
if (!fs.existsSync('databases')) {
  fs.mkdirSync('databases');
}

http
  .createServer((req, res) => {
    // Rota principal (HTML)
    if (req.url === '/' && req.method === 'GET') {
      fs.readFile(path.join(__dirname, 'index.html'), (erro, pagina) => {
        if (erro) {
          res.writeHead(500, { 'Content-Type': 'text/html' });
          res.write('<h1>Erro ao carregar a página</h1>');
        } else {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.write(pagina);
        }
        res.end();
      });
    }

    // Rota para arquivos estáticos (CSS, JS, imagens)
    else if (req.url.match(/.css$|.js$|.png$|.jpg$/)) {
      const filePath = path.join(__dirname, 'public', req.url);
      const extname = path.extname(filePath);
      let contentType = 'text/css'; // Padrão para CSS

      if (extname === '.js') contentType = 'text/javascript';
      else if (extname === '.png') contentType = 'image/png';
      else if (extname === '.jpg') contentType = 'image/jpeg';

      fs.readFile(filePath, (erro, conteudo) => {
        if (erro) {
          res.writeHead(404);
          res.end('Arquivo não encontrado');
        } else {
          res.writeHead(200, { 'Content-Type': contentType });
          res.end(conteudo);
        }
      });
    }

    // Rota para criar banco de dados (POST)
    else if (req.url === '/criar-db' && req.method === 'POST') {
      const form = formidable();

      form.parse(req, (erro, campos) => {
        const nameDB = campos.nameDB;
        fs.mkdir(`databases/${nameDB}`, (erro) => {
          if (erro) {
            res.writeHead(500, { 'Content-Type': 'text/html' });
            res.write(`<h1>Erro ao criar DB: ${erro.message}</h1>`);
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.write(`
            <h1>Banco de Dados criado com sucesso!</h1>
            <p>Nome: ${nameDB}</p>
            <a href="/">Voltar</a>
          `);
          }
          res.end();
        });
      });
    }

    // Rota para ler os bancos de dados
    else if (req.url === '/list-dbs' && req.method === 'GET') {
      fs.readdir('databases', (err, databases) => {
        if (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Erro ao ler bancos' }));
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ databases }));
        }
      });
    }

    //Rota para criar tabelas
    else if (req.url === '/create-table' && req.method === 'POST') {
      let body = '';

      req.on('data', (chunk) => {
        body += chunk.toString();
      });

      req.on('end', () => {
        try {
          const { dbName, tableName, fields } = JSON.parse(body);

          // Validações
          if (!dbName || !tableName || !fields || !Array.isArray(fields)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(
              JSON.stringify({
                success: false,
                message: 'Dados inválidos',
              })
            );
          }

          const dbPath = `databases/${dbName}`;
          const tablePath = `${dbPath}/${tableName}.json`;

          // Verifica se o banco existe
          if (!fs.existsSync(dbPath)) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            return res.end(
              JSON.stringify({
                success: false,
                message: 'Banco de dados não encontrado',
              })
            );
          }

          // Verifica se tabela já existe
          if (fs.existsSync(tablePath)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(
              JSON.stringify({
                success: false,
                message: 'Tabela já existe',
              })
            );
          }

          // Valida campos
          const validatedFields = fields.map((field) => {
            // Define tamanhos padrão para alguns tipos
            if (!field.size) {
              if (field.type === 'VARCHAR') field.size = 255;
              else if (field.type === 'INT') field.size = 11;
            }

            return {
              name: field.name.trim(),
              type: field.type,
              size: field.size ? parseInt(field.size) : null,
              primary: !!field.primary,
              nullable: !!field.nullable,
              default: null,
            };
          });

          // Cria a estrutura da tabela
          const tableStructure = {
            name: tableName,
            fields: validatedFields,
            createdAt: new Date().toISOString(),
            records: [],
          };

          // Salva o arquivo
          fs.writeFileSync(tablePath, JSON.stringify(tableStructure, null, 2));

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              success: true,
              message: 'Tabela criada com sucesso',
              table: tableStructure,
            })
          );
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              success: false,
              message: error.message,
            })
          );
        }
      });
    }

    //Rota paraInserir registro
    else if (req.url === '/insert-record' && req.method === 'POST') {
      let body = '';

      req.on('data', (chunk) => {
        body += chunk.toString();
      });

      req.on('end', () => {
        try {
          const { dbName, tableName, record } = JSON.parse(body);

          if (!dbName || !tableName || !record) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Dados inválidos' }));
          }

          const tablePath = path.join('databases', dbName, `${tableName}.json`);

          if (!fs.existsSync(tablePath)) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Tabela não encontrada' }));
          }

          // Carrega a tabela
          const tableData = JSON.parse(fs.readFileSync(tablePath, 'utf8'));

          // Valida os campos do registro
          const errors = [];
          tableData.fields.forEach((field) => {
            if (!field.nullable && record[field.name] === undefined) {
              errors.push(`Campo ${field.name} é obrigatório`);
            }
          });

          if (errors.length > 0) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: errors.join(', ') }));
          }

          // Adiciona o registro
          tableData.records.push(record);

          // Salva a tabela atualizada
          fs.writeFileSync(tablePath, JSON.stringify(tableData, null, 2));

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              success: true,
              message: 'Registro inserido com sucesso',
            })
          );
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              success: false,
              message: error.message,
            })
          );
        }
      });
    }

    //Rota para listas tabela
    else if (req.url?.startsWith('/list-tables') && req.method === 'GET') {
      const urlParams = new URL(req.url, `http://${req.headers.host}`);
      const dbName = urlParams.searchParams.get('db');

      if (!dbName) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(
          JSON.stringify({ error: 'Nome do banco não fornecido' })
        );
      }

      const dbPath = path.join('databases', dbName);

      try {
        // Verifica se o diretório existe
        if (!fs.existsSync(dbPath)) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Banco não encontrado' }));
        }

        // Lê todos os arquivos .json no diretório do banco
        const tables = fs
          .readdirSync(dbPath)
          .filter((file) => file.endsWith('.json'))
          .map((file) => file.replace('.json', ''));

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ tables }));
      } catch (error) {
        console.error('Erro ao listar tabelas:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Erro ao listar tabelas' }));
      }
    }

    //Rota de estrutura
    else if (req.url?.startsWith('/table-structure') && req.method === 'GET') {
      const urlParams = new URL(req.url, `http://${req.headers.host}`);
      const dbName = urlParams.searchParams.get('db');
      const tableName = urlParams.searchParams.get('table');

      if (!dbName || !tableName) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Parâmetros incompletos' }));
      }

      const tablePath = path.join('databases', dbName, `${tableName}.json`);

      try {
        if (!fs.existsSync(tablePath)) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Tabela não encontrada' }));
        }

        const tableData = JSON.parse(fs.readFileSync(tablePath, 'utf8'));

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            success: true,
            fields: tableData.fields,
            createdAt: tableData.createdAt,
          })
        );
      } catch (error) {
        console.error('Erro ao carregar estrutura:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({ error: 'Erro ao carregar estrutura da tabela' })
        );
      }
    }
    //Rota para listas os registros
    else if (req.url?.startsWith('/list-records') && req.method === 'GET') {
      const urlParams = new URL(req.url, `http://${req.headers.host}`);
      const dbName = urlParams.searchParams.get('db');
      const tableName = urlParams.searchParams.get('table');

      if (!dbName || !tableName) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Parâmetros incompletos' }));
      }

      const tablePath = path.join('databases', dbName, `${tableName}.json`);

      try {
        if (!fs.existsSync(tablePath)) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Tabela não encontrada' }));
        }

        const tableData = JSON.parse(fs.readFileSync(tablePath, 'utf8'));

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            success: true,
            records: tableData.records,
            fields: tableData.fields,
            count: tableData.records.length,
          })
        );
      } catch (error) {
        console.error('Erro ao listar registros:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Erro ao listar registros' }));
      }
    }

    //Rota não encontrada (404)
    else {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.write('<h1>Página não encontrada</h1>');
      res.end();
    }
  })
  .listen(3455);

console.log('Servidor rodando em http://localhost:3455');
