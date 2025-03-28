import fs from "fs";
import http from "http";
import { formidable } from "formidable";
import path from "path";
import { fileURLToPath } from "url";

// Configura caminhos para ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cria a pasta 'databases' se não existir
if (!fs.existsSync("databases")) {
  fs.mkdirSync("databases");
}

http.createServer((req, res) => {
  // Rota principal (HTML)
  if (req.url === "/" && req.method === "GET") {
    fs.readFile(path.join(__dirname, "index.html"), (erro, pagina) => {
      if (erro) {
        res.writeHead(500, { "Content-Type": "text/html" });
        res.write("<h1>Erro ao carregar a página</h1>");
      } else {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.write(pagina);
      }
      res.end();
    });
  }

  // Rota para arquivos estáticos (CSS, JS, imagens)
  else if (req.url.match(/.css$|.js$|.png$|.jpg$/)) {
    const filePath = path.join(__dirname, "public", req.url);
    const extname = path.extname(filePath);
    let contentType = "text/css"; // Padrão para CSS

    if (extname === ".js") contentType = "text/javascript";
    else if (extname === ".png") contentType = "image/png";
    else if (extname === ".jpg") contentType = "image/jpeg";

    fs.readFile(filePath, (erro, conteudo) => {
      if (erro) {
        res.writeHead(404);
        res.end("Arquivo não encontrado");
      } else {
        res.writeHead(200, { "Content-Type": contentType });
        res.end(conteudo);
      }
    });
  }

  // Rota para criar banco de dados (POST)
  else if (req.url === "/criar-db" && req.method === "POST") {
    const form = formidable();

    form.parse(req, (erro, campos) => {
      const nameDB = campos.nameDB;
      fs.mkdir(`databases/${nameDB}`, (erro) => {
        if (erro) {
          res.writeHead(500, { "Content-Type": "text/html" });
          res.write(`<h1>Erro ao criar DB: ${erro.message}</h1>`);
        } else {
          res.writeHead(200, { "Content-Type": "text/html" });
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
  else if (req.url === "/list-dbs" && req.method === "GET") {
  fs.readdir("databases", (err, databases) => {
    if (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Erro ao ler bancos" }));
    } else {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ databases }));
    }
  });
}

  //Rota para criar tabelas
  else if (req.url === '/create-table' && req.method === 'POST') {
  let body = '';

  req.on('data', chunk => {
    body += chunk.toString();
  });

  req.on('end', () => {
    try {
      const { dbName, tableName, fields } = JSON.parse(body);

      // Validações
      if (!dbName || !tableName || !fields || !Array.isArray(fields)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          success: false,
          message: 'Dados inválidos'
        }));
      }

      const dbPath = `databases/${dbName}`;
      const tablePath = `${dbPath}/${tableName}.json`;

      // Verifica se o banco existe
      if (!fs.existsSync(dbPath)) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          success: false,
          message: 'Banco de dados não encontrado'
        }));
      }

      // Verifica se tabela já existe
      if (fs.existsSync(tablePath)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          success: false,
          message: 'Tabela já existe'
        }));
      }

      // Valida campos
      const validatedFields = fields.map(field => {
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
          default: null
        };
      });

      // Cria a estrutura da tabela
      const tableStructure = {
        name: tableName,
        fields: validatedFields,
        createdAt: new Date().toISOString(),
        records: []
      };

      // Salva o arquivo
      fs.writeFileSync(tablePath, JSON.stringify(tableStructure, null, 2));

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        message: 'Tabela criada com sucesso',
        table: tableStructure
      }));

    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        message: error.message
      }));
    }
  });
}

  // Rota não encontrada (404)
  else {
    res.writeHead(404, { "Content-Type": "text/html" });
    res.write("<h1>Página não encontrada</h1>");
    res.end();
  }


}).listen(3456);

console.log("Servidor rodando em http://localhost:3456");