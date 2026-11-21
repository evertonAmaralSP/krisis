# CLAUDE.md — KRISIS

<!-- Estrutura baseada no scaffold do ia-cookbook (sem as partes de ClickUp).
Comentários HTML não entram no contexto. Mantenha só o que vale em 100% das sessões
e não se descobre lendo o código. Todo caminho citado precisa existir. -->

Plano, requisitos, decisões aprovadas e etapas: @docs/PLANO.md

## Contexto

Portal web pessoal para treinar entrevistas de emprego por voz, em português do Brasil, com um entrevistador de IA. Um único usuário, rodando na máquina local, sem GPU. Conversa por turnos (botão "Terminei de falar"), sem tempo real. Marca: **KRISIS**.

------

## Topologia

| Componente | Onde vive | Papel |
|---|---|---|
| Contrato da API | `contracts/src/v1` | zod → tipos do servidor e do web + `openapi/v1.json` |
| API | `server/` (Fastify, porta 3001) | rotas finas em `http/v1`, lógica em `application/`, adaptadores em `infra/` |
| Portal | `web/` (React + Vite, porta 5173) | consome só o contrato; proxy `/api` para a API |
| Banco | `data/krisis.db` (SQLite, gitignored) | via `DataSourceFactory` + Kysely |
| Voz local (etapa 3) | `tts-kokoro/` (Python) | Kokoro exposto por HTTP |

**Fluxos-chave**
- Turno por voz = `POST /interviews/{id}/transcriptions` (áudio → texto) + `POST /interviews/{id}/messages` (texto → resposta). O turno por texto usa só o segundo.
- O motor (STT, LLM, TTS) de cada entrevista é gravado nela e resolvido pela `EngineFactory`; o padrão vem do `.env`.
- Não há ambiente de produção nem deploy. Publicação (Netlify + Supabase) é a etapa 8, opcional.

------

## Convenções

- **API First:** toda mudança de API começa em `contracts/`; depois `npm run openapi`. Quebra de compatibilidade vira `/api/v2`, nunca altera a v1.
- **Banco trocável:** consultas só nos repositórios de `infra/datasource/sql/`; serviços conhecem só `ports/`. Migration aplicada nunca é editada: crie a próxima, portável entre SQLite e Postgres.
- **Motores trocáveis:** motor novo estende a base do tipo em `infra/engines/base/` (implementa só o `do*`) e é registrado na `EngineFactory`. Não sobrescreva o método-modelo da base. Nomes de modelos vêm do `.env`, nunca fixos no código.
- **Antes de implementar um fornecedor:** consulte a documentação oficial atual e mostre ao usuário o que encontrou.
- **Serverless-ready:** nada depende de disco local nem de estado em memória entre requisições; `buildApp()` nunca chama `listen()`.
- **Visual:** siga `docs/design/` e `docs/marca/`. Logo só o PNG oficial, nunca redesenhado. Tokens de tema em `web/src/styles/global.css`.
- **Testes:** "testado" = `npm test` e `npm run typecheck` verdes, sem chave de API (motores falsos). Fluxo novo de ponta a ponta ganha teste em `server/test/api.test.ts`.
- **Worktrees:** toda worktree em **`.worktrees/<branch>`**, via a skill `using-git-worktrees` (já no `.gitignore`).

------

## Fluxo de Trabalho

Escolha a trilha **antes** de agir.

**A) Exploratório / trivial** — pergunta, leitura, debug pequeno, ajuste de uma linha. Apenas resolva.

**B) Etapa do plano ou mudança não-trivial:**

1. **Isole** → skill `using-git-worktrees` (destino `.worktrees/<branch>`).
2. **Alinhe o design** quando houver ambiguidade → skill `brainstorming`. Decisão de impacto (biblioteca, formato, forma de rodar um serviço): apresente opções e recomendação, não escolha em silêncio.
3. **Pesquise antes de codar.** Sem editar nesta fase.
4. **Planeje** → skill `writing-plans`. Apresente e **pare** para aprovação.
5. **Plano grande** → skill `handle-large-tasks`.
6. **Implemente** com o critério de "testado" acima.
7. **Atualize** `README.md` e `docs/PLANO.md` no que a mudança invalidou.
8. **Finalize** → skill `finishing-a-development-branch`. Ao fim de cada etapa: diga como testar e faça o commit.

------

## Git

- **Branches** kebab-case: `feat/<escopo>-<resumo>`, `fix/<escopo>-<resumo>`, `chore/<escopo>-<resumo>`.
- **Commits** Conventional Commits: `<tipo>(<escopo>): <descrição imperativa>`. Prefixo em inglês, descrição em português. Ex.: `feat(voz): adicionar transcrição pelo Groq`.
- Sem versionamento automático por enquanto.
- PR por `gh pr create`.

------

## Tom

Não seja bajulador. Eu nem sempre estou certo.

- Sinalize quando não souber, em vez de preencher a lacuna.
- Sinalize ideias ruins, expectativas irreais e erros meus.
- Pare e pergunte quando duas interpretações levarem a trabalho diferente.
- Se discordar, **rebata** com argumento técnico. Questione padrões de projeto que não se encaixem na tecnologia.
- **Nunca** use "Você está absolutamente certo" ou equivalente.

------

## Limites e Autonomia

Você tem autonomia para atingir o objetivo da etapa, **exceto**:

- Não leia nem imprima o `.env` (chaves de API e hash de senha).
- Não chame fornecedores pagos (Groq, Google) em testes automatizados; só em verificação manual combinada.
- Não troque a conversa por turnos por tempo real (WebRTC, streaming, detecção de pausa).
- Implemente a v1 (Google) só depois de a v0 ser aprovada.

> Comandos destrutivos e curinga em remoção são bloqueados pelo `PreToolUse` em `.claude/hooks/guard-destrutivo.sh`.

------

## Idioma

Responder ao usuário **100% em português do Brasil**, inclusive mensagens curtas de status, descrições de comando e commits. Identificadores de código seguem o inglês do repositório.
