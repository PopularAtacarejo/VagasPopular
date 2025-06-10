# Script de Limpeza Automática de Currículos

Este script automatiza a limpeza de currículos armazenados no GitHub, removendo:

1. **Currículos antigos**: Registros com mais de 2 meses
2. **Duplicatas**: Currículos com mesmo CPF e vaga (mantém o mais recente)

## 🚀 Configuração

### 1. Variáveis de Ambiente

Certifique-se de que as seguintes variáveis estão configuradas no seu arquivo `.env`:

```env
GITHUB_USER=seu-usuario-github
REPO_NAME=nome-do-repositorio
BRANCH=main
TOKEN=seu-github-token
CURRICULO_DIR=curriculos
```

### 2. Configuração do GitHub Actions

O script pode ser executado automaticamente através do GitHub Actions:

- **Execução automática**: Todos os dias às 09:00 UTC (06:00 horário de Brasília)
- **Execução manual**: Através da aba "Actions" do repositório

#### Configuração de Variáveis no GitHub

1. Vá para **Settings** > **Secrets and variables** > **Actions**
2. Na aba **Variables**, adicione:
   - `CURRICULO_DIR`: Diretório onde os currículos são armazenados (ex: `curriculos`)

O `GITHUB_TOKEN` é fornecido automaticamente pelo GitHub Actions.

**⏰ Horário de Execução**: O script executa automaticamente todos os dias às 09:00 UTC (06:00 horário de Brasília).

## 📋 Como Usar

### Execução Manual Local

```bash
# Instalar dependências (se necessário)
npm install

# Executar o script
node cleanup-curriculos.js
```

### Execução via GitHub Actions

1. Vá para a aba **Actions** do seu repositório
2. Selecione o workflow "Limpeza Automática de Currículos"
3. Clique em **Run workflow**

## 🔍 O que o Script Faz

### Limpeza por Idade
- Remove currículos com data de envio superior a 2 meses
- Deleta tanto o registro no `dados.json` quanto o arquivo físico

### Limpeza de Duplicatas
- Identifica registros com mesmo CPF e vaga
- Mantém apenas o registro mais recente
- Remove os registros e arquivos duplicados mais antigos

### Relatório de Execução
O script gera um log detalhado mostrando:
- Número total de registros processados
- Quantos registros foram removidos por idade
- Quantas duplicatas foram encontradas e removidas
- Quantos registros foram mantidos
- Lista de arquivos deletados

## 📁 Estrutura de Arquivos

```
seu-repositorio/
├── .github/
│   └── workflows/
│       └── cleanup-curriculos.yml    # Configuração do GitHub Actions
├── cleanup-curriculos.js             # Script principal de limpeza
├── server.js                         # Servidor principal
├── dados.json                        # Arquivo com registros dos currículos
└── curriculos/                       # Diretório com arquivos de currículos
    ├── arquivo1.pdf
    ├── arquivo2.pdf
    └── ...
```

## ⚠️ Considerações Importantes

1. **Backup**: O script remove permanentemente arquivos e registros. Certifique-se de ter backups se necessário.

2. **Rate Limiting**: O script inclui pequenas pausas entre operações para evitar limitações da API do GitHub.

3. **Permissões**: O token do GitHub deve ter permissões de escrita no repositório.

4. **Logs**: Monitore os logs do GitHub Actions para verificar se a limpeza está funcionando corretamente.

## 🛠️ Personalização

### Alterar Período de Retenção

Para alterar o período de 2 meses, modifique esta linha no `cleanup-curriculos.js`:

```javascript
const doisMesesAtras = new Date(agora.getTime() - (2 * 30 * 24 * 60 * 60 * 1000));
```

### Alterar Frequência de Execução

Para alterar a frequência do GitHub Actions, modifique o cron no arquivo `.github/workflows/cleanup-curriculos.yml`:

```yaml
schedule:
  - cron: '0 9 * * *'  # Todos os dias às 09:00 UTC
```

## 📞 Suporte

Em caso de problemas:

1. Verifique os logs do GitHub Actions
2. Confirme se todas as variáveis de ambiente estão configuradas
3. Verifique se o token tem as permissões necessárias

