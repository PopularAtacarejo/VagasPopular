const axios = require('axios');
require('dotenv').config();

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

/**
 * Obtém o SHA de um arquivo no GitHub
 */
async function getFileSha(path) {
  try {
    const res = await githubApi.get(`/repos/${GITHUB_USER}/${REPO_NAME}/contents/${path}`);
    return res.data.sha;
  } catch (err) {
    return null;
  }
}

/**
 * Deleta um arquivo do GitHub
 */
async function deleteFileFromGitHub(githubPath, message) {
  try {
    const sha = await getFileSha(githubPath);
    if (!sha) {
      console.log(`Arquivo não encontrado: ${githubPath}`);
      return false;
    }

    await githubApi.delete(`/repos/${GITHUB_USER}/${REPO_NAME}/contents/${githubPath}`, {
      message,
      sha,
      branch: BRANCH
    });
    
    console.log(`Arquivo deletado: ${githubPath}`);
    return true;
  } catch (error) {
    console.error(`Erro ao deletar arquivo ${githubPath}:`, error.message);
    return false;
  }
}

/**
 * Atualiza o arquivo dados.json no GitHub
 */
async function updateDadosJson(registros) {
  try {
    const jsonPath = 'dados.json';
    const content = Buffer.from(JSON.stringify(registros, null, 2)).toString('base64');
    const sha = await getFileSha(jsonPath);

    await githubApi.put(`/repos/${GITHUB_USER}/${REPO_NAME}/contents/${jsonPath}`, {
      message: 'Limpeza automática de currículos',
      content,
      branch: BRANCH,
      ...(sha && { sha })
    });

    console.log('Arquivo dados.json atualizado com sucesso');
  } catch (error) {
    console.error('Erro ao atualizar dados.json:', error.message);
    throw error;
  }
}

/**
 * Carrega os dados do arquivo dados.json
 */
async function loadDadosJson() {
  try {
    const jsonPath = 'dados.json';
    const response = await githubApi.get(`/repos/${GITHUB_USER}/${REPO_NAME}/contents/${jsonPath}`);
    const content = Buffer.from(response.data.content, 'base64').toString();
    return JSON.parse(content);
  } catch (error) {
    console.log('Arquivo dados.json não encontrado ou vazio, retornando array vazio');
    return [];
  }
}

/**
 * Extrai o nome do arquivo da URL do GitHub
 */
function extractFileNameFromUrl(url) {
  const parts = url.split('/');
  return parts[parts.length - 1];
}

/**
 * Função principal de limpeza
 */
async function cleanupCurriculos() {
  try {
    console.log('Iniciando limpeza de currículos...');
    
    // Carrega os dados atuais
    const registros = await loadDadosJson();
    console.log(`Total de registros encontrados: ${registros.length}`);

    if (registros.length === 0) {
      console.log('Nenhum registro encontrado para limpeza');
      return;
    }

    const agora = new Date();
    const doisMesesAtras = new Date(agora.getTime() - (2 * 30 * 24 * 60 * 60 * 1000)); // 2 meses atrás
    
    let registrosParaManter = [];
    let arquivosParaDeletar = [];
    let registrosRemovidos = 0;
    let duplicatasRemovidas = 0;

    // Mapa para controlar duplicatas por CPF + vaga
    const cpfVagaMap = new Map();

    for (const registro of registros) {
      const dataRegistro = new Date(registro.data);
      const chaveUnica = `${registro.cpf}-${registro.vaga}`;
      
      // Verifica se o registro tem mais de 2 meses
      if (dataRegistro < doisMesesAtras) {
        console.log(`Removendo registro antigo: ${registro.nome} (${registro.data})`);
        
        // Adiciona o arquivo à lista de deleção
        if (registro.arquivo) {
          const nomeArquivo = extractFileNameFromUrl(registro.arquivo);
          arquivosParaDeletar.push(`${CURRICULO_DIR}/${nomeArquivo}`);
        }
        
        registrosRemovidos++;
        continue;
      }

      // Verifica duplicatas por CPF + vaga
      if (cpfVagaMap.has(chaveUnica)) {
        const registroExistente = cpfVagaMap.get(chaveUnica);
        const dataExistente = new Date(registroExistente.data);
        
        // Mantém o mais recente
        if (dataRegistro > dataExistente) {
          // Remove o registro anterior da lista de manter
          const indiceAnterior = registrosParaManter.findIndex(r => r === registroExistente);
          if (indiceAnterior !== -1) {
            registrosParaManter.splice(indiceAnterior, 1);
            
            // Adiciona o arquivo anterior à lista de deleção
            if (registroExistente.arquivo) {
              const nomeArquivo = extractFileNameFromUrl(registroExistente.arquivo);
              arquivosParaDeletar.push(`${CURRICULO_DIR}/${nomeArquivo}`);
            }
          }
          
          // Atualiza o mapa com o registro mais recente
          cpfVagaMap.set(chaveUnica, registro);
          registrosParaManter.push(registro);
          
          console.log(`Substituindo duplicata: ${registroExistente.nome} por ${registro.nome} (CPF: ${registro.cpf}, Vaga: ${registro.vaga})`);
        } else {
          // Mantém o existente, remove o atual
          if (registro.arquivo) {
            const nomeArquivo = extractFileNameFromUrl(registro.arquivo);
            arquivosParaDeletar.push(`${CURRICULO_DIR}/${nomeArquivo}`);
          }
          
          console.log(`Removendo duplicata mais antiga: ${registro.nome} (CPF: ${registro.cpf}, Vaga: ${registro.vaga})`);
        }
        
        duplicatasRemovidas++;
      } else {
        // Primeiro registro com essa combinação CPF + vaga
        cpfVagaMap.set(chaveUnica, registro);
        registrosParaManter.push(registro);
      }
    }

    console.log(`\nResumo da limpeza:`);
    console.log(`- Registros originais: ${registros.length}`);
    console.log(`- Registros removidos por idade (>2 meses): ${registrosRemovidos}`);
    console.log(`- Duplicatas removidas: ${duplicatasRemovidas}`);
    console.log(`- Registros mantidos: ${registrosParaManter.length}`);
    console.log(`- Arquivos para deletar: ${arquivosParaDeletar.length}`);

    // Deleta os arquivos do GitHub
    if (arquivosParaDeletar.length > 0) {
      console.log('\nDeletando arquivos...');
      for (const arquivo of arquivosParaDeletar) {
        await deleteFileFromGitHub(arquivo, 'Limpeza automática: removendo arquivo antigo/duplicado');
        // Pequena pausa para evitar rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Atualiza o dados.json apenas se houve mudanças
    if (registrosRemovidos > 0 || duplicatasRemovidas > 0) {
      await updateDadosJson(registrosParaManter);
      console.log('\nLimpeza concluída com sucesso!');
    } else {
      console.log('\nNenhuma limpeza necessária.');
    }

  } catch (error) {
    console.error('Erro durante a limpeza:', error.message);
    process.exit(1);
  }
}

// Executa a limpeza se o script for chamado diretamente
if (require.main === module) {
  cleanupCurriculos()
    .then(() => {
      console.log('Script de limpeza finalizado');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Erro fatal:', error.message);
      process.exit(1);
    });
}

module.exports = { cleanupCurriculos };

