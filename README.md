# KRISIS — treino de entrevistas por voz

Portal pessoal para treinar entrevistas de emprego com um entrevistador de IA, em português do Brasil.
Plano, decisões e etapas: [`docs/PLANO.md`](docs/PLANO.md). Telas de referência: [`docs/design/`](docs/design/).

> **Etapa atual: 3** — entrevista por voz de ponta a ponta: você fala (transcrição no Groq), o entrevistador responde (modelo no Groq) e **fala** (Kokoro local, em CPU). Também por texto.

## Requisitos

- Node.js 22.12+ (testado no 25)
- npm 10+ (o projeto usa npm workspaces)
- Ferramentas de compilação para o `better-sqlite3`, caso não haja binário pronto: `g++`, `make`, `python3`
- Uma chave de API do [Groq](https://console.groq.com/keys)

## Instalação

### 1. Portal e API

```bash
cd /caminho/absoluto/para/krisis
npm install
cp .env.example .env
npm run hash-password      # digite a senha (mín. 12 caracteres) e copie a linha gerada
```

### 2. Voz do entrevistador (Kokoro, local)

Requer [`uv`](https://docs.astral.sh/uv/getting-started/installation/) e o `espeak-ng` (fonemas do português):

```bash
sudo apt-get install -y espeak-ng          # Debian/Ubuntu/WSL
npm --prefix /caminho/absoluto/para/krisis run tts:setup
```

O `tts:setup` cria o ambiente Python (PyTorch **só de CPU**, ~1,3 GB) e baixa o modelo Kokoro-82M (~330 MB) e as vozes em português num **commit fixo** do Hugging Face, conferindo o **SHA256** de cada arquivo (motivo: incidente com a conta do modelo em 18/11/2026). Depois disso o serviço roda **offline**.

Sem a voz instalada o portal funciona normalmente, só com texto. Para desligar de propósito: `TTS_ENGINE=none`.

### 3. Configuração

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
- Voz (Kokoro): http://127.0.0.1:8880/health
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
| `STT_ENGINE` | `groq` | Motor de transcrição, escolhido na `EngineFactory` (`groq`, `fake`) |
| `STT_MODEL` | `whisper-large-v3-turbo` | Modelo de transcrição no fornecedor |
| `STT_LANGUAGE` | `pt` | Idioma falado (ISO-639-1) |
| `TTS_ENGINE` | `kokoro` | Voz do entrevistador (`kokoro`, `fake`, `none` = sem voz) |
| `TTS_VOICE` | `pf_dora` | `pf_dora` (feminina), `pm_alex` ou `pm_santa` (masculinas) |
| `TTS_SPEED` | `1.0` | Velocidade da fala (0,5 a 2) |
| `TTS_THREADS` | `8` | Threads de CPU do Kokoro (8 foi o melhor num i7-1355U) |
| `KOKORO_BASE_URL` | `http://127.0.0.1:8880/v1` | Endereço do serviço de voz |
| `SESSION_TTL_DAYS` | `30` | Validade da sessão |
| `COOKIE_SECURE` | `false` | `true` só quando servido por HTTPS |

Para testar sem chave de API: `LLM_ENGINE=fake` e `STT_ENGINE=fake`.

## Microfone

- Use Chrome, Edge ou Firefox atualizados. O navegador pede permissão na primeira vez; se negar, libere no ícone de cadeado da barra de endereço.
- O portal precisa ser aberto em `http://localhost` (ou HTTPS): o navegador só libera o microfone nesses endereços.
- Clique em **Falar**, responda e clique em **Terminei de falar**. **Esc** cancela a gravação. O limite é de 5 minutos por resposta.
- Gravação em silêncio (microfone mudo ou errado) é barrada antes de enviar: aparece "Não ouvi nada".
- A voz do entrevistador toca sozinha depois de cada resposta. **Clicar em Falar interrompe** e começa a gravar; "Ouvir" repete qualquer fala.

## Como a voz é gerada

O Kokoro roda em CPU: medido num i7-1355U, ~0,7 s para uma frase curta e ~1,8 s para 70 caracteres; a fala gerada dura cerca de o dobro do tempo de síntese. Por isso a resposta é dividida em **trechos** (`server/src/application/speech/sentences.ts`): o primeiro é curto quando há uma pausa natural, nenhum passa de 70 caracteres, e o portal toca um trecho enquanto já pede o seguinte (`GET /api/v1/messages/{id}/speech?part=N`). O áudio não é guardado.

## Rodar uma segunda cópia (ex.: numa worktree)

```bash
PORT=3101 API_PORT=3101 WEB_PORT=5273 SQLITE_PATH=/tmp/krisis-teste.db npm run dev
```

`PORT` é a API; `API_PORT` e `WEB_PORT` são lidos pelo Vite. Com um `SQLITE_PATH` próprio, a cópia não mexe no banco principal.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Sobe API e portal |
| `npm test` | Testes do servidor (usam motor falso e SQLite em memória; não precisam de chave) |
| `npm run typecheck` | Checagem de tipos de contratos, servidor e web |
| `npm run openapi` | Regenera `openapi/v1.json` a partir do contrato |
| `npm run hash-password` | Gera o hash da senha para o `.env` |
| `npm run reset-password` | Redefine a senha direto no banco e encerra as sessões (recuperação de acesso) |
| `npm run tts:setup` | Instala o serviço de voz e baixa o modelo conferido |
| `npm run tts:bench` | Mede o tempo de síntese nesta máquina e grava amostras das vozes em `tts-kokoro/amostras/` |
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
    engines/     EngineFactory · base/ (template method: LLM, STT, TTS) · openai-compatible/ (Groq, Kokoro) · fake/
    security/    Argon2
  http/v1/       Rotas finas sob /api/v1
  app.ts         buildApp() sem listen (servidor, testes, serverless)
web/src/         React: layout/, pages/, chat/ (useRecorder, useTurno, useSpeech), api/ (cliente tipado), theme/
tts-kokoro/      Serviço Python da voz: app.py (/v1/audio/speech), engine.py, download_model.py (commit fixo + SHA256)
openapi/v1.json  Contrato publicado (um teste falha se ficar desatualizado)
```

- **Trocar de banco:** criar uma classe que estende `SqlDataSource` (só `createDialect()`) ou implementa `DataSource`, e registrá-la em `DataSourceFactory`.
- **Trocar de motor:** criar uma classe que estende `BaseLlmEngine` (`doComplete()`), `BaseSttEngine` (`doTranscribe()`) ou `BaseTtsEngine` (`doSynthesize()`), registrá-la em `EngineFactory` e mudar `LLM_ENGINE`/`STT_ENGINE`/`TTS_ENGINE`.
- **Mudança que quebra a API:** nova versão em `contracts/src/v2` e `http/v2`, convivendo com a v1.
