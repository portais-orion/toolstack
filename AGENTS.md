# AGENTS.md

Este arquivo fornece instruções, diretrizes de arquitetura e convenções do projeto para Agentes de IA e assistentes de código que trabalham neste repositório.

---

## 1. Visão Geral do Projeto

O **Toolstack Orion** é um catálogo web estático que documenta e cruza ferramentas, tecnologias, serviços e sistemas utilizados nos projetos do **Grupo Orion** (Superterminais, SuperTrans, Aurora EADI).

### Principais Características
- **Sem Frameworks & Sem Bundlers:** Construído exclusivamente com Vanilla HTML5, CSS3 moderno e Vanilla JavaScript (ES6+).
- **Sem Backend / Totalmente Estático:** Os dados são consumidos em tempo de execução a partir de arquivos JSON locais via `fetch()`.
- **Publicação:** Hospedado automaticamente no **GitHub Pages** via GitHub Actions.
- **Dependências Externas:** Apenas Google Fonts (Inter) e CDN do Simple Icons (ambas com fallback gracioso).

---

## 2. Comandos Essenciais

### Servir Localmente
Como o `index.html` realiza `fetch("tools.json")` e `fetch("systems.json")`, abrir diretamente pelo protocolo `file://` falhará por políticas de CORS do navegador. É obrigatório rodar um servidor HTTP local:

```bash
# Opção 1: Node.js (sem instalação)
npx serve .

# Opção 2: Python 3
python -m http.server 8080
```

### Validação do Dataset
O repositório possui um script Node.js sem dependências para validação estática dos dados:

```bash
node validate.js
```

> **Atenção:** Sempre execute `node validate.js` após editar `tools.json` ou `systems.json`. Este teste é executado no pipeline de CI do GitHub Actions antes de qualquer deploy.

---

## 3. Estrutura do Repositório

```text
toolstack/
├── .github/
│   └── workflows/
│       └── deploy.yml    # Pipeline de CI/CD para GitHub Pages
├── assets/               # Imagens da marca Orion (logo, mark, favicon) e logos locais
├── index.html            # Estrutura semântica da página e marcação dos modais/palette
├── styles.css            # Design tokens, variáveis CSS, temas claro/escuro e responsividade
├── app.js                # Lógica da aplicação, roteamento por hash, filtros e renderização (~1.2k linhas)
├── tools.json            # Dataset de ferramentas e tecnologias (visão Ferramentas)
├── systems.json          # Dataset de sistemas e produtos do grupo (visão Sistemas)
├── validate.js           # Validador de consistência dos dados JSON
├── CLAUDE.md             # Instruções específicas para Claude Code
├── AGENTS.md             # Este manual de diretrizes para agentes de IA
└── README.md             # Documentação do projeto para humanos
```

---

## 4. Arquitetura da Aplicação (`app.js`)

Toda a lógica frontend é mantida em um único arquivo `app.js` encapsulado por uma **IIFE** (`(function() { "use strict"; ... })()`).

### 4.1. Estado Global (`S`)
A aplicação mantém o estado em um objeto central:
- `S.tools`: lista de ferramentas carregadas de `tools.json`.
- `S.systems`: lista de sistemas carregados de `systems.json`.
- `S.byId`: mapa indexado por `id` das ferramentas para consultas O(1).
- `S.q`: termo atual de busca/filtro.
- `S.cat`: categoria selecionada (padrão: `"Todas"`).
- `S.sort`: ordenação ativa (`"use"` para mais usadas, `"name"` para alfabética).
- `S.view`: visão ativa (`"tools"`, `"systems"`, `"matrix"`).
- `S.sysCompany` / `S.toolCompany`: filtros por empresa.
- `S.matrixMode`: modo de exibição da matriz (`"cards"` ou `"compare"`).

### 4.2. Três Visões Principais (Roteamento via Hash)
1. **Ferramentas (`#tools`)**: Catálogo em cards com busca, filtros de categoria e ordenação por uso/nome.
2. **Sistemas (`#systems`)**: Produtos do grupo agrupados por empresa, detalhando objetivo, plataforma, arquitetura e stack completa.
3. **Matriz (`#matrix`)**: Comparador lado a lado das tecnologias adotadas entre os diferentes sistemas.

### 4.3. Deep Linking & Cross-Linking
- `#tool/<id>` abre o modal detalhado da ferramenta.
- `#system/<id>` expande e foca o card do sistema correspondente.
- **Cross-link Ferramenta → Sistema:** O mapa `PROJ2SYS` em `app.js` traduz os nomes de pastas dos projetos (`projects` em `tools.json`) para o `id` do sistema em `systems.json`.
- **Cross-link Sistema → Ferramenta:** Clicar num chip de tecnologia invoca `jumpToTool(id)`.

### 4.4. Fallback Determinístico de Logos
A função `mountLogo(el, tool, px)` tenta carregar a imagem do logo. Se houver erro de carregamento (404/URL quebrada), invoca automaticamente `hue(tool.name)` para gerar um monograma estilizado com cor determinística. **Nunca crie tratamentos manuais em dados para logos quebrados.**

---

## 5. Regras para Edição de Dados (`tools.json` e `systems.json`)

### 5.1. Regras para `tools.json`
Cada entrada no array deve seguir a estrutura:
```json
{
  "id": "kebab-case-unico",
  "name": "Nome da Ferramenta",
  "category": "Nome da Categoria",
  "logo": "https://cdn.simpleicons.org/<slug>/<cor-hex-sem-#>",
  "description": "Descrição sucinta de 1-2 frases do que é a ferramenta.",
  "usage": "Descrição factual de como o Grupo Orion utiliza a ferramenta.",
  "projects": ["nucleo-portais", "superfood"],
  "link": "https://url-oficial.com"
}
```
- **ID:** Único, minúsculo, separado por hífens (`kebab-case`).
- **Categorias:** Não são um enum estático; são inferidas dinamicamente a partir dos valores do JSON.
- **Uso:** Deve refletir evidências reais nos repositórios (package.json, Dockerfile, etc.). Não invente uso.

### 5.2. Regras para `systems.json`
Cada entrada no array deve seguir a estrutura:
```json
{
  "id": "kebab-case-unico",
  "name": "Nome do Sistema",
  "company": "Superterminais | SuperTrans | Aurora EADI | Grupo Orion",
  "companyColor": "#hex",
  "platform": "web | mobile | web-mobile",
  "status": "Em produção | Em desenvolvimento",
  "objective": "Objetivo do sistema em 2-4 frases.",
  "repoPath": "caminho/do/repositorio",
  "architecture": "Descrição da arquitetura (monorepo, packages, etc.).",
  "stackHighlights": ["Destaque 1", "Destaque 2"],
  "toolIds": ["react", "typescript", "tailwind-css"]
}
```
- **`toolIds`:** Todos os IDs devem existir obrigatoriamente em `tools.json`.
- **`platform`:** Suporta `"web"`, `"mobile"` ou `"web-mobile"` (mapeados no objeto `PLAT` em `app.js`).

### 5.3. Sincronização Obrigatória no `PROJ2SYS` (`app.js`)
Ao adicionar um novo sistema em `systems.json` ou alterar seu `repoPath`, verifique se o mapa `PROJ2SYS` no início do `app.js` contém a associação:
```javascript
var PROJ2SYS = {
  "pasta-do-projeto": "id-do-sistema",
  // ...
};
```

---

## 6. Diretrizes de Código e Estilo

1. **Vanilla First:** Não adicione frameworks JS (React, Vue, Svelte) ou bibliotecas de terceiros via npm.
2. **CSS & Design System:**
   - Utilize as variáveis CSS declaradas no `:root` e no `body.light` em `styles.css` (`--bg`, `--surface`, `--text`, `--accent`, etc.).
   - Mantenha a compatibilidade com ambos os temas (Dark por padrão, Light opcional).
   - Preserve o design refinado com glassmorphism, micro-interações e bordas sutis.
3. **Acessibilidade & Atalhos de Teclado:**
   - `ESC`: Fecha modais e a Command Palette.
   - `/` ou `Ctrl + K` / `Cmd + K`: Abre a Command Palette.
   - Mantenha elementos interativos acessíveis via teclado.

---

## 7. Checklist para Agentes antes de Concluir Tarefas

- [ ] Executou `node validate.js` e todos os checks passaram sem erros ou avisos indevidos.
- [ ] Garantiu que novos `toolIds` em `systems.json` existem em `tools.json`.
- [ ] Atualizou o mapa `PROJ2SYS` em `app.js` caso um novo sistema ou pasta de projeto tenha sido adicionado.
- [ ] Verificou se o HTML/CSS mantém consistência visual tanto no modo claro quanto no escuro.
- [ ] Não adicionou dependências de build ou pacotes desnecessários.
