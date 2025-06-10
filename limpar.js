require('dotenv').config();
const fs = require('fs');
const axios = require('axios');

// --- Configurações e Variáveis de Ambiente ---
const { GITHUB_USER, REPO_NAME, BRANCH, TOKEN, CURRICULO_DIR } = process.env;

// Validação das variáveis de ambiente
if (!GITHUB_USER || !REPO_NAME || !BRANCH || !TOKEN) {
  console.error('Erro: Variáveis de ambiente GITHUB_USER, REPO_NAME, BRANCH e TOKEN devem ser definidas.');
  process.exit(1);
}

// Constantes
const JSON_PATH = 'dados.json';
const TEMP_DIR = './temp';
const MONTHS_TO_KEEP = 2; // Meses para manter os registros

// --- Configuração da API do GitHub ---
const githubApi = axios.create({
  baseURL: 'https://api.github.com',
  headers: {
    Authorization: `token ${TOKEN}`,
    Accept: 'application/vnd.github.v3+json'
  }
});

// --- Funções Auxiliares ---

/**
 * Obtém o SHA de um arquivo no repositório GitHub.
 * @param {string} filePath - Caminho do arquivo no repositório.
 * @returns {Promise<string|null>} O SHA do arquivo ou null se não encontrado/erro.
 */
async function getFileSha(filePath) {
  try {
    const res = await githubApi.get(`/repos/${GITHUB_USER}/${REPO_NAME}/contents/${filePath}`);
    return res.data.sha;
  } catch (err) {
    if (err.response && err.response.status === 404) {
      console.warn(`Arquivo não encontrado no GitHub: ${filePath}`);
    } else {
      console.error(`Erro ao obter SHA do arquivo ${filePath}:`, err.message);
    }
    return null;
  }
}

/**
 * Deleta um arquivo do repositório GitHub.
 * @param {string} filePath - Caminho do arquivo a ser deletado.
 * @param {string} nome - Nome associado ao arquivo (para a mensagem de commit).
 */
async function deleteFile(filePath, nome = 'desconhecido') {
  const sha = await getFileSha(filePath);
  if (sha) {
    try {
      await githubApi.delete(`/repos/${GITHUB_USER}/${REPO_NAME}/contents/${filePath}`, {
        data: {
          message: `Remove arquivo duplicado ou antigo de ${nome}`,
          sha,
          branch: BRANCH
        }
      });
      console.info(`Arquivo removido: ${filePath}`);
    } catch (err) {
      console.error(`Erro ao remover arquivo ${filePath}:`, err.message);
    }
  }
}

/**
 * Carrega os registros do arquivo JSON no GitHub.
 * @returns {Promise<Array>} Lista de registros ou array vazio em caso de erro/não encontrado.
 */
async function loadRecords() {
  try {
    const response = await githubApi.get(`/repos/${GITHUB_USER}/${REPO_NAME}/contents/${JSON_PATH}`);
    const content = Buffer.from(response.data.content, 'base64').toString();
    const records = JSON.parse(content);
    console.info(`Total de registros carregados: ${records.length}`);
    return records;
  } catch (e) {
    if (e.response && e.response.status === 404) {
      console.warn(`${JSON_PATH} não encontrado. Iniciando com registros vazios.`);
    } else {
      console.error(`Erro ao carregar ${JSON_PATH}:`, e.message);
    }
    return [];
  }
}

/**
 * Salva os registros atualizados no arquivo JSON no GitHub.
 * @param {Array} records - Lista de registros a serem salvos.
 */
async function saveRecords(records) {
  // Garante que o diretório temporário exista
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR);
  }

  const localPath = `${TEMP_DIR}/${JSON_PATH}`;
  fs.writeFileSync(localPath, JSON.stringify(records, null, 2));

  const content = fs.readFileSync(localPath, { encoding: 'base64' });
  const sha = await getFileSha(JSON_PATH);

  try {
    await githubApi.put(`/repos/${GITHUB_USER}/${REPO_NAME}/contents/${JSON_PATH}`, {
      message: 'Limpeza automática de duplicatas e registros antigos',
      content,
      branch: BRANCH,
      ...(sha && { sha }) // Adiciona o SHA apenas se o arquivo já existir
    });
    console.info(`${JSON_PATH} atualizado com sucesso no GitHub.`);
  } catch (err) {
    console.error(`Erro ao salvar ${JSON_PATH} no GitHub:`, err.message);
  }
}

// --- Função Principal de Limpeza ---

async function limparCurriculos() {
  console.info('Iniciando processo de limpeza de currículos...');
  let registros = await loadRecords();

  if (registros.length === 0) {
    console.info('Nenhum registro para processar. Limpeza concluída.');
    return;
  }

  const agora = new Date();
  const vistos = new Set();
  const finais = [];
  const filesToDelete = [];

  for (const reg of registros) {
    const chave = `${reg.cpf}-${reg.vaga}`;
    const dataRegistro = new Date(reg.data);
    const diffMeses = (agora - dataRegistro) / (1000 * 60 * 60 * 24 * 30);

    if (vistos.has(chave) || diffMeses >= MONTHS_TO_KEEP) {
      // Extrai o caminho relativo do arquivo no GitHub
      const caminhoGit = reg.arquivo.split(`/${BRANCH}/`)[1];
      if (caminhoGit) {
        console.info(`Marcando para remoção: ${reg.nome}, CPF: ${reg.cpf}, Vaga: ${reg.vaga}, Arquivo: ${caminhoGit}`);
        filesToDelete.push({ filePath: caminhoGit, nome: reg.nome });
      } else {
        console.warn(`Caminho do arquivo inválido para remoção: ${reg.arquivo}`);
      }
    } else {
      finais.push(reg);
      vistos.add(chave);
    }
  }

  // Executa as deleções em paralelo para otimizar
  await Promise.all(filesToDelete.map(item => deleteFile(item.filePath, item.nome)));

  await saveRecords(finais);

  console.info('Limpeza concluída com sucesso!');
}

// --- Execução ---
limparCurriculos();


