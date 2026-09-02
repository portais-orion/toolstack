# Orion Agent Skills: onboarding e guia de uso

## Objetivo

Transformar a área `Skills` do Stack Orion em ponto de onboarding para a biblioteca de Agent Skills do Grupo Orion. A página continua priorizando o catálogo das 26 skills Orion e ganha um guia curto, verificável e navegável para instalar, atualizar e diagnosticar o ambiente.

## Escopo

### Catálogo

- Manter a rota `#skills`, os filtros e os agrupamentos atuais.
- Tornar cada card de skill acionável.
- Abrir detalhes num drawer/modal já existente na aplicação, exibindo nome, área, descrição e link para a biblioteca Orion.
- Não criar campos curados de “quando não usar”, standards relacionados ou saídas esperadas nesta fase. Esses dados não possuem estrutura canônica uniforme na biblioteca fonte.

### Navegação interna

A área `Skills` usa abas internas, separadas da navegação global do Stack Orion:

| Aba/link | Comportamento |
| --- | --- |
| `Catálogo` | Exibe as 26 skills agrupadas e filtráveis. |
| `Guia de uso` | Navega para `#skills/guia` dentro da mesma view da SPA. |
| `GitHub ↗` | Abre `portais-orion/orion-agent-skills` em nova aba como link textual discreto. |

O comando `npx @portais-orion/skills@latest` aparece destacado no início do guia, com ação pequena de copiar. Não há modal de instalação separado.

### Guia de uso

A rota `#skills/guia` é uma view da SPA existente, sem aplicação, dependência ou página separada. O conteúdo é renderizado de `orion-skills-guide.json` e possui os seguintes blocos:

1. Introdução e pré-requisitos: Node.js >= 18.17, Git e acesso ao repositório privado Orion; Claude Code e/ou Codex são opcionais para instalação, mas necessários para consumir as skills.
2. Instalação global com `npx @portais-orion/skills@latest` e sua forma explícita `install`.
3. Fontes instaladas: Orion (`portais-orion/orion-agent-skills`), Matt Pocock (`mattpocock/skills`) e Superpowers (`obra/superpowers`).
4. Uso no projeto: iniciar Claude Code ou Codex no repositório; em tarefas normais, descrever a necessidade em linguagem natural para que o agente selecione a skill contextual.
5. Comandos verificados: `install`, `update`, `list`, `list --json`, `sources` e `doctor`.
6. Exemplos práticos de prompts, atualização, diagnóstico e FAQ.

Cada comando de terminal possui ação de cópia. Os exemplos de prompt são educacionais: não prometem seleção determinística da skill, apenas mostram o caso de uso correspondente.

## Dados e validação

- `orion-skills.json` continua como snapshot das skills próprias Orion extraído de `C:\projetos\orion-agent-skills`.
- `orion-skills-guide.json` registra a documentação de onboarding e referências de origem no CLI em `C:\projetos\orion-skills-cli\README.md`.
- `validate.js` valida o novo arquivo: campos obrigatórios, IDs únicos, comandos e referências de fonte.
- Um teste de contrato local compara o catálogo Orion com a biblioteca e confirma que os comandos exibidos estão documentados pelo CLI.

## Rotas e estado

| Rota | Resultado |
| --- | --- |
| `#skills` | Catálogo filtrável das skills Orion. |
| `#skills/guia` | Guia de instalação e uso. |
| `#skill/<nome>` | Abre detalhes da skill e preserva deep link. |

Os detalhes usam o padrão existente de sheet/modal, fecham com `Esc` ou backdrop e restauram o estado da rota ao fechar. As abas mantêm `aria-selected` sincronizado com `#skills` e `#skills/guia`.

## UI e acessibilidade

- Reutilizar tokens, tipografia, botões, cards, modal e temas existentes.
- O guia é composto de blocos leves, comandos monoespaçados e chamadas visuais discretas; não deve parecer uma documentação pesada.
- Abas e ações de cópia recebem rótulos acessíveis; estado de cópia é anunciado visualmente.
- O layout permanece responsivo, com CTAs empilhados em telas estreitas.

## Fora de escopo

- Instalar ou executar o CLI pelo navegador.
- Gerar documentação individual completa para cada skill.
- Duplicar standards ou conteúdo de `SKILL.md` no Toolstack.
- Publicar, fazer deploy ou alterar o instalador Orion.

## Verificação

1. Teste de contrato para os datasets e conteúdo fonte.
2. `node --check app.js`.
3. `node validate.js`.
4. Servidor HTTP local: `#skills`, `#skills/guia` e deep link de uma skill carregam os dados esperados.
5. Verificação de diff sem whitespace inválido.
