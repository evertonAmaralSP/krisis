# Plano: portal de treino de entrevistas por voz

## Contexto

Quero um portal web para eu treinar entrevistas de emprego por voz. O uso é pessoal: um único usuário (eu), rodando no meu computador, sem placa de vídeo dedicada. Um entrevistador de IA faz perguntas em português do Brasil, eu respondo falando, e ele reage ao que eu disse. No fim, recebo um feedback escrito sobre a entrevista.

Aceito até 2 segundos de atraso entre eu terminar de falar e a resposta começar. Por isso não quero tempo real: nada de WebRTC, streaming de áudio ou detecção automática de pausa. A conversa funciona por turnos, com um botão que eu aperto para avisar que terminei de falar. Essa escolha mantém o projeto simples e barato, então não a troque por algo mais sofisticado.

## Stack

- Frontend: React + Vite + TypeScript.
- Backend: Node.js + TypeScript (Express ou Fastify, escolha um e justifique em uma linha).
- Banco: SQLite, em arquivo local.
- Monorepo simples com `web/` e `server/`, e um comando único para subir os dois em desenvolvimento.

## Fluxo de um turno

1. Clico em "Falar"; o navegador grava com `MediaRecorder`.
2. Clico em "Terminei de falar"; o áudio vai ao backend como arquivo.
3. O backend transcreve o áudio, envia o histórico da conversa ao modelo de linguagem e converte a resposta em áudio.
4. O frontend mostra minha fala transcrita, depois o texto da resposta, e toca o áudio.

Mostre o texto assim que ele existir, sem esperar o áudio ficar pronto, para o atraso percebido ser menor. Registre no log do servidor o tempo de cada etapa (transcrição, modelo, voz), porque vou usar esses números para decidir entre os provedores.

## Provedores: v0 e v1

O ponto central da arquitetura é que transcrição, modelo de linguagem e voz ficam atrás de três interfaces (`SttProvider`, `LlmProvider`, `TtsProvider`), escolhidas por variável de ambiente. A v1 troca os provedores sem tocar nas telas nem nas rotas.

| Etapa | v0 (opção 1) | v1 (opção 3) |
|---|---|---|
| Transcrição | Whisper large-v3-turbo no Groq | Gemini (modelo de transcrição) |
| Modelo de linguagem | Modelo barato no Groq | Gemini Flash |
| Voz | Kokoro rodando localmente, voz `pf_dora` ou `pm_alex` | Google Cloud TTS, voz Chirp 3 HD em pt-BR |

Pontos de atenção:

- Nomes de modelos, endpoints e preços mudam com frequência. Antes de implementar cada provedor, consulte a documentação oficial atual e me mostre o que encontrou. Deixe os nomes dos modelos em variáveis de ambiente, nunca fixos no código.
- O Groq tem endpoint compatível com a API da OpenAI; confirme na documentação e use isso se simplificar.
- Kokoro: as vozes em português funcionam com certeza na versão Python. Verifique se existe um pacote Node que suporte `pf_dora`. Se não existir ou estiver instável, rode o Kokoro como um serviço local separado (Python, exposto por HTTP) e faça o Node chamá-lo. Documente a instalação passo a passo no README.
- Implemente a v1 somente depois que eu aprovar a v0 funcionando.

## Telas

1. **Login.** E-mail e senha de um único usuário, definidos por variável de ambiente (senha guardada como hash). Sessão em cookie `httpOnly`. Sem cadastro, sem recuperação de senha, sem login social.
2. **Chat.** Layout comum de aplicativos de conversa:
   - barra lateral recolhível com o histórico de entrevistas e o botão "Nova entrevista";
   - coluna central com as mensagens (as minhas e as do entrevistador);
   - área de entrada fixa embaixo, com o botão de microfone em destaque e um campo de texto como alternativa quando eu não puder falar;
   - indicação clara do estado atual: gravando, transcrevendo, pensando, falando.
3. **Nova entrevista.** Formulário curto: vaga, empresa, nível (júnior, pleno, sênior), tipo (comportamental, técnica, mista) e campos opcionais para colar a descrição da vaga e o meu currículo. Esses dados alimentam as instruções do entrevistador.
4. **Feedback.** Ao encerrar, o modelo gera uma avaliação a partir da transcrição completa: pontos fortes, pontos a melhorar e sugestões de resposta para as perguntas em que fui pior. Fica salvo junto com a entrevista.
5. **Configurações.** Acessada pela barra lateral: nome, e-mail, troca de senha e tema (Sistema, Claro, Escuro).

Crie uma identidade visual própria, com tema claro e escuro, e interface em português. Use o layout de aplicativos de conversa apenas como referência de estrutura; não copie nome, logotipo, cores de marca nem outros elementos visuais de nenhum produto existente.

## Comportamento do entrevistador

- Fala português do Brasil, em tom profissional e natural.
- Faz uma pergunta por vez e espera a resposta.
- Respostas curtas (duas a quatro frases), porque texto longo vira áudio longo e aumenta o atraso.
- Faz perguntas de aprofundamento com base no que eu respondi, em vez de seguir uma lista fixa.
- Não dá feedback durante a entrevista; isso fica para a tela de feedback.

## Dados

Guarde no SQLite: entrevistas (configuração, datas, provedores usados), mensagens (autor, texto, duração de cada etapa) e feedback. Não precisa guardar os arquivos de áudio; a transcrição basta.

## Segurança

- As chaves de API ficam só no backend, em `.env`. O frontend nunca as recebe.
- Inclua `.env.example` com todas as variáveis e coloque `.env` e o arquivo do banco no `.gitignore`.
- Todas as rotas da API, exceto o login, exigem sessão válida.

## Arquitetura (requisitos adicionais)

- **API First.** A API REST é o produto; o frontend é só um cliente dela. O contrato (OpenAPI) é a fonte da verdade.
- **Versionamento.** Toda rota fica sob `/api/v1`. Mudança que quebra compatibilidade vira `/api/v2`, convivendo com a v1.
- **MCP no futuro.** A lógica fica em serviços de aplicação independentes de HTTP, para que um servidor MCP reaproveite os mesmos serviços.
- **Banco trocável.** O acesso a dados fica atrás de interfaces. Trocar o banco significa implementar uma nova classe de datasource e registrá-la numa factory, sem mexer em serviços nem rotas.
- **Motores trocáveis.** Transcrição, modelo de linguagem e voz seguem interfaces, com factory e template method. Um motor novo é uma classe nova, sem refatorar as existentes.
- Se um padrão de projeto não for adequado à tecnologia, questione e proponha a alternativa.

### Preparação para publicar (Netlify + Supabase)

O desenvolvimento é local, mas o código não pode impedir a publicação futura. Valem desde a etapa 1:

1. O app é montado por uma função `buildApp()`, separada do `listen()`, para rodar tanto como servidor quanto dentro de uma função serverless (`@fastify/aws-lambda`).
2. Nada depende de disco local nem de estado em memória entre requisições (sessão, cache, arquivos temporários persistentes).
3. As migrations são escritas em Kysely de forma portável entre SQLite e Postgres, sem tipos ou recursos exclusivos do SQLite.
4. O motor de voz declara o formato do áudio que devolve (`mimeType`), e a rota repassa esse formato. WAV para o Kokoro local; formato comprimido (MP3/Opus) para motores em nuvem e para publicação.

## Decisões aprovadas (20/11/2026)

Estas decisões prevalecem sobre trechos anteriores deste documento quando houver conflito.

### Stack e organização
- Monorepo com **npm workspaces**: `contracts/`, `server/`, `web/`, `tts-kokoro/`. `npm run dev` sobe tudo. (O plano previa pnpm; o corepack desta máquina falha ao baixar o pnpm 12, então ficou npm, que faz o mesmo papel.)
- Backend em **Fastify**: TypeScript, validação por schema e multipart em plugins oficiais.
- Camadas no servidor: `domain/` (entidades), `application/` (serviços/casos de uso), `ports/` (interfaces), `infra/` (adaptadores), `http/v1/` (rotas finas). O MCP futuro entra como outro adaptador ao lado de `http/`, reaproveitando os serviços.

### API First e versionamento
- Contrato em **zod** no pacote `contracts/`, que gera tipos para servidor e frontend e o **OpenAPI 3.1**, servido em `/api/v1/openapi.json` com documentação em `/api/v1/docs`.
- O `openapi/v1.json` gerado é versionado; um teste falha se estiver desatualizado.
- Autenticação atrás de uma interface: hoje cookie de sessão; depois, token Bearer para o MCP.

### Banco
- Interfaces de repositório (`UserRepository`, `InterviewRepository`, `MessageRepository`, `FeedbackRepository`, `SessionRepository`).
- `DataSourceFactory` escolhe a implementação por `DB_DRIVER`.
- `SqlDataSource` abstrata com template method no ciclo de vida (`init()`: criar dialeto → conectar → migrar → checar). `SqliteDataSource` implementa só `createDialect()`.
- Consultas escritas uma vez com **Kysely** (dialetos SQLite, Postgres, MySQL, MSSQL); driver SQLite `better-sqlite3`.
- Banco não-SQL: nova classe que implementa `DataSource` com repositórios próprios.

### Motores (transcrição, modelo, voz)
- Classes base com template method: o roteiro (validar → medir tempo → chamar fornecedor → padronizar erro → registrar no log) fica na base; cada motor implementa só `doTranscribe`, `doComplete` ou `doSynthesize`.
- `EngineFactory` com registro nome → classe. Herança limitada a dois níveis (exceção: `OpenAiCompatibleLlmEngine`, base do Groq e do Gemini).
- O motor de voz devolve `{ audio, mimeType, ms }`; a rota repassa o `Content-Type`.

### Áudio
- Gravação: WebM/Opus (padrão do `MediaRecorder`; o Groq aceita direto).
- Resposta: WAV no Kokoro local (sem custo de codificação); formato comprimido (MP3/Opus) nos motores em nuvem e na publicação.
- Kokoro roda como **serviço Python local** (FastAPI + `kokoro`, gerenciado com `uv`), chamado por HTTP. O `kokoro-js` não documenta as vozes em português.

### Conta e autenticação
- Credenciais no banco (tabela `users`), não mais no `.env`. No primeiro uso, se não houver usuário, o servidor cria a conta a partir de `ADMIN_EMAIL` e `ADMIN_PASSWORD_HASH`; depois o banco é a fonte da verdade.
- Senha com **argon2**. Troca de senha exige a senha atual e encerra as outras sessões. Troca de e-mail exige a senha atual.
- Sem recuperação por e-mail: `pnpm reset-password` redefine a senha localmente.
- Sessão em cookie `httpOnly`, guardada na tabela `sessions`.

### Rotas da API (`/api/v1`)

| Método e rota | O que faz |
|---|---|
| `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` | Sessão |
| `GET /account`, `PATCH /account` | Nome e e-mail |
| `POST /account/password` | Trocar senha |
| `GET /interviews`, `POST /interviews` | Listar e criar entrevistas |
| `GET /interviews/{id}` | Entrevista com mensagens |
| `POST /interviews/{id}/transcriptions` | Áudio (multipart) → texto da fala |
| `POST /interviews/{id}/messages` | Texto do candidato → resposta do entrevistador (usado pela voz e pelo texto) |
| `GET /messages/{id}/speech` | Áudio da resposta |
| `POST /interviews/{id}/finish`, `GET /interviews/{id}/feedback` | Encerrar e ler o feedback |

O turno por voz são duas chamadas (transcrever, depois responder), para a tela mostrar "transcrevendo" e "pensando" como estados reais e exibir a fala transcrita antes da resposta.

### Esquema do banco
```
users(id, name, email UNIQUE, password_hash, created_at, updated_at)
sessions(id, user_id, expires_at, created_at)
interviews(id, user_id, title, role, company, level, kind, job_description, resume,
           stt_engine, llm_engine, tts_engine, status, created_at, finished_at)
messages(id, interview_id, author, content, input_mode, audio_seconds,
         stt_ms, llm_ms, tts_ms, created_at)
feedback(interview_id PK, summary, strengths, improvements, suggestions, llm_ms, created_at)
```

### Frontend
- Rotas: `/entrar`, `/entrevistas/nova`, `/entrevistas/:id`, `/entrevistas/:id/feedback`, `/configuracoes`. As internas ficam num layout com a barra lateral e exigem sessão.
- Componentes: `Sidebar`, `MessageList`, `MessageBubble`, `Composer` (`MicButton` + texto), `StatusPill`, `SegmentedControl`, `TimingTable`.
- Estado do turno numa máquina de estados (`useTurno`: pronto → gravando → transcrevendo → pensando → falando, mais erro); `useRecorder` encapsula o `MediaRecorder`.
- Dados com TanStack Query; estilos com CSS Modules; fontes Manrope e DM Sans via `@fontsource` (sem CDN).

### Visual
- Telas de referência: canvas https://claude.ai/artifact/MiyzR5GYSbPbFmJeTYPgse (cópia em `docs/design/`).
- Tema em **Configurações**, com três opções: Sistema (padrão), Claro, Escuro. Não há botão de tema no topo das telas. A preferência fica salva no navegador.
- Tema claro: fundo `#FAF7FF`, cartões brancos, texto `#1B1029`, secundário `#5E5170`, roxo `#7A2BD6`, coral `#C42A52`. Tema escuro: tokens do book.
- Botões com texto branco usam o gradiente roxo → magenta (`#7A2BD6` → `#B8307A`) por contraste; o gradiente completo da marca fica nos elementos decorativos.
- Logo: o PNG oficial, acompanhado do nome "KRISIS" em Manrope, como na landing page.

## Identidade visual

A marca é **KRISIS** (do próprio autor). A fonte da verdade é `docs/marca/KRISIS_Book_de_Referencia_Visual.md` (e o PDF). Use exclusivamente o logo `docs/marca/krisis_logo_oficial_aplicacao.png`, sem redesenhar em SVG ou CSS. A landing page `docs/marca/krisis_landing_page_referencia.html` serve de referência de tokens e componentes.

## Etapas

**v0**
1. Estrutura do projeto, login e tela de chat funcionando com mensagens de texto e um modelo de linguagem real. (Entregue junto: formulário de nova entrevista, histórico na barra lateral e tema em Configurações.)
2. Gravação no navegador e transcrição. (Entregue: Groq `whisper-large-v3-turbo` via endpoint compatível com a OpenAI, áudio WebM/Opus sem conversão, resposta `json` e duração medida no navegador, `language=pt` + contexto da vaga no `prompt`, limite de 5 min/10 MB, silêncio barrado no navegador pelo nível do som e alucinações conhecidas do Whisper barradas no servidor com 422. Medido: ~1,3 s do "Terminei de falar" ao texto do entrevistador numa resposta de 15 s.)
3. Voz com Kokoro e reprodução no navegador.
4. Formulário de nova entrevista, histórico e persistência; conta em Configurações (nome, e-mail, troca de senha).
5. Feedback final.

**v1**
6. Provedores do Google implementando as mesmas três interfaces.
7. Seletor de provedor por entrevista e exibição dos tempos de cada etapa, para eu comparar v0 e v1.

**Publicação (opcional, depois da v1)**
8. `PostgresDataSource` para o Supabase e publicação. A arquitetura é decidida com base na comparação v0 × v1:
   - **A)** Netlify (frontend + Fastify em função) + Supabase (Postgres) + voz do Google. Mais simples e barata; sem Kokoro e com partida a frio.
   - **B)** Netlify (frontend) + container (Cloud Run, Fly.io ou GKE) com Fastify e Kokoro + Supabase. Mantém o Kokoro, sem partida a frio nem limite de tempo; a Netlify encaminha `/api/*` ao container.
   - Em ambas: login exposto na internet exige limite de tentativas; confirmar na documentação atual os limites de tempo, tamanho de requisição e região das funções da Netlify antes de implementar.

## Como trabalhar

- Antes de escrever código, apresente um plano curto com a estrutura de pastas, as rotas da API e o esquema do banco, e espere minha aprovação.
- Trabalhe uma etapa por vez. Ao fim de cada uma, diga como eu testo e faça um commit.
- Quando houver uma decisão com impacto relevante (biblioteca, formato de áudio, forma de rodar o Kokoro), apresente as opções e a sua recomendação em vez de escolher em silêncio.
- Escreva testes para a camada de provedores usando versões falsas, para que os testes rodem sem chave de API.
- Mantenha um `README.md` com instalação, variáveis de ambiente e como rodar.
- Se algo deste documento for inviável ou estiver desatualizado, avise e proponha a alternativa.

## Critérios de aceite da v0

- Entro com login e senha, crio uma entrevista e converso por voz do início ao fim.
- Em respostas de até 30 segundos, o texto do entrevistador aparece em até 2 segundos depois de eu clicar em "Terminei de falar".
- A entrevista aparece no histórico e posso reabrir a transcrição e o feedback.
- Trocar de provedor exige mudar apenas variáveis de ambiente.
