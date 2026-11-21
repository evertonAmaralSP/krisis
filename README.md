# KRISIS — treino de entrevistas por voz

Portal pessoal para treinar entrevistas de emprego com um entrevistador de IA, em português do Brasil.
Plano, decisões e etapas: [`docs/PLANO.md`](docs/PLANO.md). Telas de referência: [`docs/design/`](docs/design/).

> **Etapa atual: 1** — login, chat por texto com modelo real (Groq), criação de entrevista, histórico e tema.
> Voz (gravação, transcrição e fala) entra nas etapas 2 e 3.

## Requisitos

- Node.js 22.12+ (testado no 25)
- npm 10+ (o projeto usa npm workspaces)
- Ferramentas de compilação para o `better-sqlite3`, caso não haja binário pronto: `g++`, `make`, `python3`
- Uma chave de API do [Groq](https://console.groq.com/keys)

## Instalação

```bash
cd /caminho/absoluto/para/krisis
npm install
cp .env.example .env
npm run hash-password      # digite a senha (mín. 12 caracteres) e copie a linha gerada
```

Edite o `.env` e preencha pelo menos:

| Variável | O que é |
|---|---|
| `ADMIN_NAME`, `ADMIN_EMAIL` | Nome e e-mail da conta |
| `ADMIN_PASSWORD_HASH` | Linha gerada por `npm run hash-password`, **com aspas simples** |
| `GROQ_API_KEY` | Chave do Groq |

As variáveis `ADMIN_*` só são usadas no **primeiro uso**, quando o banco ainda não tem usuário. Depois disso o banco é a fonte da verdade.

## Rodar em desenvolvimento

```bash
npm run dev
```

- Portal: http://localhost:5173
- API: http://127.0.0.1:3001/api/v1
- Documentação da API (OpenAPI): http://127.0.0.1:3001/api/v1/docs

O log do servidor mostra o tempo de cada etapa (`stage: "llm"`, `ms`), usado para comparar provedores.

## Variáveis de ambiente

Todas estão comentadas em [`.env.example`](.env.example). As principais:

| Variável | Padrão | Descrição |
|---|---|---|
| `DB_DRIVER` | `sqlite` | Banco, escolhido na `DataSourceFactory` |
| `SQLITE_PATH` | `data/krisis.db` | Arquivo do banco, relativo à raiz |
| `LLM_ENGINE` | `groq` | Motor de linguagem, escolhido na `EngineFactory` (`groq`, `fake`) |
| `LLM_MODEL` | `openai/gpt-oss-20b` | Nome do modelo no fornecedor |
| `LLM_REASONING_EFFORT` | `low` | Só para modelos com raciocínio; vazio nos demais |
| `LLM_MAX_TOKENS` | `1024` | Limite de tokens por resposta |
| `SESSION_TTL_DAYS` | `30` | Validade da sessão |
| `COOKIE_SECURE` | `false` | `true` só quando servido por HTTPS |

Para testar sem chave de API: `LLM_ENGINE=fake`.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Sobe API e portal |
| `npm test` | Testes do servidor (usam motor falso e SQLite em memória; não precisam de chave) |
| `npm run typecheck` | Checagem de tipos de contratos, servidor e web |
| `npm run openapi` | Regenera `openapi/v1.json` a partir do contrato |
| `npm run hash-password` | Gera o hash da senha para o `.env` |
| `npm run reset-password` | Redefine a senha direto no banco e encerra as sessões (recuperação de acesso) |
| `npm run reset-db` | **Zera o banco** (apaga todas as entrevistas) e recria a conta a partir do `.env`. Pede para digitar `zerar`; `-- --sim` pula a confirmação. Recusa rodar com o servidor no ar |

### Zerar o banco

Use quando quiser começar do zero ou quando a conta foi criada com dados errados no `.env` (as variáveis `ADMIN_*` só valem no primeiro uso).

```bash
# 1. pare o npm run dev (Ctrl+C)
# 2. corrija ADMIN_EMAIL / ADMIN_PASSWORD_HASH no .env, se for o caso
npm run reset-db
# 3. suba de novo
npm run dev
```

O comando mostra o e-mail da conta recriada: confira se é o que você espera.

## Arquitetura em uma página

```
contracts/   Contrato da API v1 em zod → tipos do servidor e do web + OpenAPI
server/src/
  domain/        Entidades e erros
  ports/         Interfaces: repositórios, DataSource, motores, hash de senha
  application/   Serviços (AuthService, InterviewService, ConversationService) e instruções do entrevistador
  infra/
    datasource/  DataSourceFactory · SqlDataSource (template method) · sqlite/ · sql/ (Kysely: esquema, migrations, repositórios)
    engines/     EngineFactory · base/ (template method) · openai-compatible/ (Groq) · fake/
    security/    Argon2
  http/v1/       Rotas finas sob /api/v1
  app.ts         buildApp() sem listen (servidor, testes, serverless)
web/src/         React: layout/, pages/, chat/, api/ (cliente tipado), theme/
openapi/v1.json  Contrato publicado (um teste falha se ficar desatualizado)
```

- **Trocar de banco:** criar uma classe que estende `SqlDataSource` (só `createDialect()`) ou implementa `DataSource`, e registrá-la em `DataSourceFactory`.
- **Trocar de motor:** criar uma classe que estende `BaseLlmEngine` (só `doComplete()`), registrá-la em `EngineFactory` e mudar `LLM_ENGINE`.
- **Mudança que quebra a API:** nova versão em `contracts/src/v2` e `http/v2`, convivendo com a v1.
