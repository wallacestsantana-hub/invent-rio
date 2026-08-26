const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const puppeteer = require('puppeteer');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração do Cloudinary para Armazenamento de Fotos na Nuvem
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configuração do Multer com Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'inventario-diocese',
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp']
  }
});
const upload = multer({ storage });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Rota Principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/index.html'));
});

// Rota API para Cadastrar o Bem e Receber as Fotografias
app.post('/api/bens', upload.fields([
  { name: 'foto_frente', maxCount: 1 },
  { name: 'foto_verso', maxCount: 1 },
  { name: 'foto_esquerda', maxCount: 1 },
  { name: 'foto_direita', maxCount: 1 }
]), (req, res) => {
  const b = req.body;
  const sql = `INSERT INTO bens (
    codigo_cdc, titulo, vicariato, paroquia, comunidade, endereco, predio,
    local_acervo, acondicionamento, objeto, suporte, epoca, origem,
    autoria_oficina, assinatura, instituicao, seguranca, seguranca_obs,
    conservacao, conservacao_obs, protecao_legal, esfera, tipo_tombamento,
    num_tombo, altura, largura, comprimento, diametro, profundidade, peso,
    inventariante, data_cadastro
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;

  const params = [
    b.codigo_cdc, b.titulo, b.vicariato, b.paroquia, b.comunidade, b.endereco, b.predio,
    b.local_acervo, b.acondicionamento, b.objeto, b.suporte, b.epoca, b.origem,
    b.autoria_oficina, b.assinatura, b.instituicao, b.seguranca, b.seguranca_obs,
    b.conservacao, b.conservacao_obs, b.protecao_legal, b.esfera, b.tipo_tombamento,
    b.num_tombo, b.altura, b.largura, b.comprimento, b.diametro, b.profundidade, b.peso,
    b.inventariante, b.data_cadastro || new Date().toLocaleDateString('pt-BR')
  ];

  db.run(sql, params, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    const bemId = this.lastID;

    // Salva as URLs públicas geradas pelo Cloudinary
    const fotos = req.files || {};
    const insertFoto = db.prepare(`INSERT INTO fotos (bem_id, posicao, caminho_arquivo) VALUES (?, ?, ?)`);

    ['frente', 'verso', 'esquerda', 'direita'].forEach(pos => {
      const fieldName = `foto_${pos}`;
      if (fotos[fieldName] && fotos[fieldName][0]) {
        const imageUrl = fotos[fieldName][0].path; // URL HTTPS do Cloudinary
        insertFoto.run(bemId, pos, imageUrl);
      }
    });
    insertFoto.finalize();

    res.json({ message: 'Bem patrimonial cadastrado com sucesso!', bemId });
  });
});

// Rota API para Gerar a Ficha em PDF Fiel ao Word
app.get('/api/bens/:id/pdf', (req, res) => {
  const bemId = req.params.id;

  db.get(`SELECT * FROM bens WHERE id = ?`, [bemId], (err, bem) => {
    if (err || !bem) return res.status(404).send('Registro não encontrado no banco de dados.');

    db.all(`SELECT * FROM fotos WHERE bem_id = ?`, [bemId], async (err, fotos) => {
      let template = fs.readFileSync(path.join(__dirname, 'views/ficha-template.html'), 'utf8');

      const fotoMap = { frente: '', verso: '', esquerda: '', direita: '' };
      fotos.forEach(f => {
        fotoMap[f.posicao] = f.caminho_arquivo; // URL direta da imagem
      });

      // Substituição dinâmica dos dados no modelo HTML
      let html = template
        .replace(/{{num_ficha}}/g, String(bem.id).padStart(4, '0'))
        .replace(/{{vicariato}}/g, bem.vicariato || '')
        .replace(/{{paroquia}}/g, bem.paroquia || '')
        .replace(/{{comunidade}}/g, bem.comunidade || '')
        .replace(/{{codigo_cdc}}/g, bem.codigo_cdc || '')
        .replace(/{{titulo}}/g, bem.titulo || '')
        .replace(/{{endereco}}/g, bem.endereco || '')
        .replace(/{{predio}}/g, bem.predio || '')
        .replace(/{{local_acervo}}/g, bem.local_acervo || '')
        .replace(/{{acondicionamento}}/g, bem.acondicionamento || '')
        .replace(/{{objeto}}/g, bem.objeto || '')
        .replace(/{{suporte}}/g, bem.suporte || '')
        .replace(/{{epoca}}/g, bem.epoca || '')
        .replace(/{{origem}}/g, bem.origem || '')
        .replace(/{{autoria_oficina}}/g, bem.autoria_oficina || '')
        .replace(/{{assinatura}}/g, bem.assinatura || '')
        .replace(/{{instituicao}}/g, bem.instituicao || '')
        .replace(/{{seg_ruim}}/g, bem.seguranca === 'RUIM' ? 'X' : ' ')
        .replace(/{{seg_bom}}/g, bem.seguranca === 'BOM' ? 'X' : ' ')
        .replace(/{{seg_otimo}}/g, bem.seguranca === 'OTIMO' ? 'X' : ' ')
        .replace(/{{seguranca_obs}}/g, bem.seguranca_obs || '')
        .replace(/{{cons_ruim}}/g, bem.conservacao === 'RUIM' ? 'X' : ' ')
        .replace(/{{cons_bom}}/g, bem.conservacao === 'BOM' ? 'X' : ' ')
        .replace(/{{cons_otimo}}/g, bem.conservacao === 'OTIMO' ? 'X' : ' ')
        .replace(/{{conservacao_obs}}/g, bem.conservacao_obs || '')
        .replace(/{{altura}}/g, bem.altura || '-')
        .replace(/{{largura}}/g, bem.largura || '-')
        .replace(/{{comprimento}}/g, bem.comprimento || '-')
        .replace(/{{diametro}}/g, bem.diametro || '-')
        .replace(/{{profundidade}}/g, bem.profundidade || '-')
        .replace(/{{peso}}/g, bem.peso || '-')
        .replace(/{{inventariante}}/g, bem.inventariante || '')
        .replace(/{{data_cadastro}}/g, bem.data_cadastro || '')
        .replace(/{{foto_frente}}/g, fotoMap.frente)
        .replace(/{{foto_verso}}/g, fotoMap.verso)
        .replace(/{{foto_esquerda}}/g, fotoMap.esquerda)
        .replace(/{{foto_direita}}/g, fotoMap.direita);

      try {
        // Suporte dinâmico para Puppeteer (local vs nuvem)
        const launchOptions = {
          headless: 'new',
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        };

        if (fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')) {
          launchOptions.executablePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
        }

        const browser = await puppeteer.launch(launchOptions);
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
        await browser.close();

        res.contentType('application/pdf');
        res.send(pdfBuffer);
      } catch (pErr) {
        res.status(500).send('Erro ao renderizar PDF: ' + pErr.message);
      }
    });
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});