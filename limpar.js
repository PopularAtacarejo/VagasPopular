require('dotenv').config();
const fs = require('fs');
const axios = require('axios');

const {
  GITHUB_USER,
  REPO_NAME,
  BRANCH,
  TOKEN,
  CURRICULO_DIR
} = process.env;

const githubApi = axios.create({
  baseURL: 'https://api.github.com',
  headers: {
    Authorization: `token ${TOKEN}`,
    Accept: 'application/vnd.github.v3+json'
  }
});

async function getFileSha(filePath) {
  try {
    const res = await githubApi.get(`/repos/${GITHUB_USER}/${REPO_NAME}/contents/${filePath}`);
    return res.data.sha;
  } catch (err) {
    return null;
  }
}

async function deleteFile(filePath, nome = 'desconhecido') {
  const sha = await getFileSha(filePath);
  if (sha) {
    await githubApi.delete(`/repos/${GITHUB_USER}/${REPO_NAME}/contents/${filePath}`, {
      data: {
        message: `Remove arquivo duplicado ou antigo de ${nome}`,
        sha,
        branch: BRANCH
      }
    });
    console.log(`Arquivo removido: ${filePath}`);
  }
}

async function limparCurriculos() {
  const jsonPath = 'dados.json';
  let registros = [];

  try {
    const response = await githubApi.get(`/repos/${GITHUB_USER}/${REPO_NAME}/contents/${jsonPath}`);
    const content = Buffer.from(response.data.content, 'base64').toString();
    registros = JSON.parse(content);
    console.log(`Total de registros carregados: ${registros.length}`);
  } catch (e) {
    console.log('dados.json não encontrado ou vazio. Nada a limpar.');
    return;
  }

  const agora = new Date();
  const vistos = new Set();
  const finais = [];

  for (const reg of registros) {
    const chave = `${reg.cpf}-${reg.vaga}`;
    const dataRegistro = new Date(reg.data);
    const diffMeses = (agora - dataRegistro) / (1000 * 60 * 60 * 24 * 30);

    if (vistos.has(chave) || diffMeses >= 2) {
      const caminhoGit = reg.arquivo.split(`/${BRANCH}/`)[1];
      console.log(`Removendo registro duplicado ou antigo: ${reg.nome}, CPF: ${reg.cpf}, Vaga: ${reg.vaga}`);
      await deleteFile(caminhoGit, reg.nome);
    } else {
      finais.push(reg);
      vistos.add(chave);
    }
  }

  if (!fs.existsSync('./temp')) fs.mkdirSync('./temp');
  const localPath = './temp/dados.json';
  fs.writeFileSync(localPath, JSON.stringify(finais, null, 2));

  const content = fs.readFileSync(localPath, { encoding: 'base64' });
  const sha = await getFileSha(jsonPath);
  await githubApi.put(`/repos/${GITHUB_USER}/${REPO_NAME}/contents/${jsonPath}`, {
    message: 'Limpeza automática de duplicatas e registros antigos',
    content,
    branch: BRANCH,
    ...(sha && { sha })
  });

  console.log('Limpeza concluída.');
}

limparCurriculos();
