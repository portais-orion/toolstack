# Stack de Tecnologias Orion

Catálogo estático das ferramentas, tecnologias e serviços usados nos projetos do grupo Orion (Superterminais, SuperTrans, Aurora EADI).

Site publicado via GitHub Pages, sem backend, sem build step e sem dependências externas além dos ícones (Simple Icons via CDN).

O site tem duas visões, alternadas por abas no topo (e por hash na URL, `#tools` / `#systems`):

- **Ferramentas** — catálogo com busca e filtro por categoria (o que já existia).
- **Sistemas** — os produtos do grupo agrupados por empresa, cada um com objetivo, arquitetura, destaques da stack e a lista completa de tecnologias usadas.

As duas visões são cruzadas: clicar numa tecnologia dentro de um sistema leva para ela filtrada na visão Ferramentas; clicar numa tag de projeto no modal de uma ferramenta leva para o sistema correspondente, já expandido.

## Como funciona

- `index.html` — página única (HTML + CSS + JS vanilla, sem framework).
- `tools.json` — fonte de dados de todas as ferramentas catalogadas (visão Ferramentas).
- `systems.json` — fonte de dados dos sistemas/produtos do grupo (visão Sistemas): objetivo, empresa, arquitetura e `toolIds` (referencia os `id` de `tools.json`).
- `assets/` — logo da Orion (`orion-logo.png` original enviado pelo usuário, `orion-mark.png` recortado só no ícone da esfera para uso no header/rodapé, `orion-favicon.png` para o favicon).
- `.github/workflows/deploy.yml` — publica o conteúdo do repositório no GitHub Pages a cada push na branch `main`.

Não há passo de build: o `index.html` carrega `tools.json` e `systems.json` via `fetch()` em tempo de execução.

## Como rodar localmente

Como a página usa `fetch("tools.json")`, é preciso servir os arquivos por HTTP (abrir o `index.html` direto do disco com `file://` bloqueia o fetch por CORS). Qualquer servidor estático resolve:

```bash
# Python
python3 -m http.server 8080

# Node (sem instalação global)
npx serve .
```

Depois acesse `http://localhost:8080`.

## Como atualizar o catálogo

1. Abra `tools.json`.
2. Cada ferramenta é um objeto com os campos:
   - `id` — identificador único, kebab-case.
   - `name` — nome de exibição.
   - `category` — uma das categorias existentes (ou uma nova, se fizer sentido).
   - `logo` — URL de um ícone SVG/PNG. Preferência: [Simple Icons](https://simpleicons.org/) via CDN (`https://cdn.simpleicons.org/<slug>/<cor-hex-sem-#>`), assets oficiais da ferramenta, ou [Devicon](https://devicon.dev/). Se não achar um ícone confiável, deixe o campo `logo` com uma URL mesmo que possa falhar — o card cai automaticamente para um placeholder com as iniciais do nome (ver `setLogo()` em `index.html`).
   - `description` — 1-2 frases explicando o que é a ferramenta (independente do nosso uso).
   - `usage` — como *nós* usamos essa ferramenta, com base em evidência real do código/config. Não invente: se não há evidência clara, deixe isso explícito no texto.
   - `projects` — lista dos nomes de pasta em `projetos/` onde a ferramenta foi encontrada.
   - `link` — site ou documentação oficial.
3. Adicione o objeto ao array em `tools.json` (JSON válido, vírgulas entre itens).
4. Abra `index.html` localmente (servidor HTTP, ver acima) para conferir que o card aparece corretamente, o logo carrega e a busca/filtro por categoria funcionam.
5. Commit e push na branch `main` — o GitHub Actions publica automaticamente.

### Adicionando uma nova categoria

Categorias são inferidas automaticamente a partir dos valores de `category` em `tools.json` — não há lista fixa em nenhum outro lugar. Basta usar um novo valor de `category` em uma ferramenta que o filtro já aparece.

### Removendo uma ferramenta

Apague o objeto correspondente de `tools.json`.

### Logos que não carregam

Se um logo não carregar (URL quebrada, ferramenta sem ícone público confiável), o card mostra automaticamente um placeholder com as iniciais do nome — não é necessário nenhum tratamento manual. Quando tiver um arquivo de logo para enviar manualmente, salve-o em uma pasta `assets/logos/` (crie se não existir) e aponte o campo `logo` para o caminho relativo, ex. `"logo": "assets/logos/minha-ferramenta.svg"`.

## Como atualizar a página de Sistemas

1. Abra `systems.json`.
2. Cada sistema é um objeto com os campos:
   - `id` — identificador único, kebab-case (usado para deep-link e scroll ao vir do catálogo de ferramentas).
   - `name` — nome de exibição do sistema/produto.
   - `company` — empresa responsável (Superterminais, SuperTrans, Aurora EADI ou Grupo Orion quando é uma plataforma interna sem dono único). Sistemas da mesma empresa são agrupados visualmente.
   - `companyColor` — cor do indicador (bolinha) ao lado do nome da empresa. Pode reaproveitar a cor de marca do tema correspondente em `nucleo-portais/packages/tokens/src/themes/`.
   - `status` — texto livre, ex. `"Em produção"` ou `"Em desenvolvimento (...)"`. Qualquer status contendo a palavra "desenvolvimento" usa o indicador laranja (em vez do teal) automaticamente.
   - `objective` — o que o sistema faz e por quê, em 2-4 frases.
   - `repoPath` — caminho do repositório dentro de `projetos/`.
   - `architecture` — 1-2 frases sobre a organização do código (monorepo ou não, apps, packages).
   - `stackHighlights` — lista de frases curtas com os pontos mais relevantes da stack (aparece como lista com marcadores ao expandir o card).
   - `toolIds` — lista de `id`s que existem em `tools.json`. É o que popula os chips de tecnologia (preview + lista completa) e permite o cross-link para a visão Ferramentas.
3. Ao adicionar um novo sistema, garanta que todo `id` em `toolIds` já exista em `tools.json` — não há validação automática, um id inválido só falha silenciosamente (o chip não aparece).
4. Para que o cross-link "tag de projeto → sistema" funcione a partir do modal de uma ferramenta, adicione o nome de pasta do projeto (o mesmo usado no campo `projects` de `tools.json`) ao mapa `PROJECT_TO_SYSTEM` dentro do `<script>` de `index.html`.

## Publicação (GitHub Pages)

1. No GitHub, vá em **Settings → Pages**.
2. Em **Build and deployment → Source**, selecione **GitHub Actions**.
3. Qualquer push em `main` dispara o workflow `.github/workflows/deploy.yml`, que publica o conteúdo do repositório como está (sem build).

## Metodologia de catalogação

As ferramentas listadas foram identificadas a partir de evidência real nos repositórios em `projetos/`: `package.json`, lockfiles, `Dockerfile`, `docker-compose*.yml`, workflows de CI/CD (GitHub Actions e GitLab CI), arquivos `.env.example` e documentação interna (`README.md`, `CLAUDE.md`, ADRs). Ferramentas sem evidência clara de uso real não foram incluídas.

Projetos analisados: `portal-supertrans`, `nucleo-portais` (Design System Orion), `app-almoxarifado`, `Portal_Fornecedor`, `Portal-Aurora`, `superfood` (Orionfood), `supertrans-app`.

## Atualizando a análise no futuro

Quando novos projetos forem adicionados a `projetos/` ou a stack de um projeto existente mudar significativamente, repita o processo: revise manifestos e configs, identifique o que mudou, e atualize `tools.json` (adicionando, removendo ou editando entradas — em especial o campo `projects` de cada ferramenta afetada).
