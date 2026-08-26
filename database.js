const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'inventario.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // Tabela principal de Bens Móveis e Integrados
  db.run(`CREATE TABLE IF NOT EXISTS bens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo_cdc TEXT,
    titulo TEXT,
    vicariato TEXT,
    paroquia TEXT,
    comunidade TEXT,
    endereco TEXT,
    predio TEXT,
    local_acervo TEXT,
    acondicionamento TEXT,
    objeto TEXT,
    suporte TEXT,
    epoca TEXT,
    origem TEXT,
    autoria_oficina TEXT,
    assinatura TEXT,
    instituicao TEXT,
    seguranca TEXT,
    seguranca_obs TEXT,
    conservacao TEXT,
    conservacao_obs TEXT,
    protecao_legal TEXT,
    esfera TEXT,
    tipo_tombamento TEXT,
    num_tombo TEXT,
    altura REAL,
    largura REAL,
    comprimento REAL,
    diametro REAL,
    profundidade REAL,
    peso REAL,
    inventariante TEXT,
    data_cadastro TEXT
  )`);

  // Tabela de Fotografias dos Bens
  db.run(`CREATE TABLE IF NOT EXISTS fotos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bem_id INTEGER,
    posicao TEXT, -- 'frente', 'verso', 'esquerda', 'direita'
    caminho_arquivo TEXT,
    FOREIGN KEY(bem_id) REFERENCES bens(id) ON DELETE CASCADE
  )`);
});

module.exports = db;