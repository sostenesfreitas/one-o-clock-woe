# Design — Troca de idioma pt-BR / Inglês (i18n)

**Data:** 2026-06-12
**App:** WOE Party Organizer (`app.html`, single-file, vanilla JS, sem build step)
**Objetivo:** Permitir que a guild use o app em **Português (Brasil)** ou **Inglês**,
removendo o tailandês da interface. O tailandês atual serve apenas como texto-fonte
para produzir as traduções e desaparece da UI ao final.

---

## Decisões fixadas (brainstorming)

| Decisão | Escolha |
|---|---|
| Idiomas | **Somente pt-BR + Inglês.** Tailandês removido da UI (vira fonte de tradução). |
| Idioma padrão | **pt-BR** (guild brasileira); inglês como alternativa. |
| Jargão de jogo | Termos de Ragnarok/WoE (Card, Knight, party, nomes de item) ficam **literais em inglês/original** — NÃO entram no dicionário. Só a UI ao redor (botões, títulos, mensagens, dias da semana) é traduzida. |
| Mecanismo | **Dicionário central** `LOCALES` + função `t('chave')` + atributos `data-i18n` no markup estático. |
| Persistência | **Por dispositivo** (`localStorage`), FORA do `state` — não sincroniza pelo Firebase. Cada membro escolhe o seu. |
| Seletor | Botão **`PT | EN`** no cabeçalho; troca ao vivo (sem reload). |
| Rollout | **Faseado** — motor primeiro, depois telas principais, depois secundárias, depois varredura final. |
| Glossário | Entregue em `docs/i18n-glossary.md` (TH→EN→pt-BR) para revisão do usuário. |

---

## 1. Motor de i18n (núcleo)

Adicionado no topo do `<script>`, perto das constantes existentes (próximo a
`PARTIES` / `APP_VERSION`).

```js
const LOCALES = {
  'pt-BR': { 'common.save': 'Salvar', 'auction.create': 'Criar leilão', /* ... */ },
  'en':    { 'common.save': 'Save',   'auction.create': 'Create auction', /* ... */ }
};

let currentLocale = localStorage.getItem('woe_locale') || 'pt-BR';

function setLocale(loc) {
  if (!LOCALES[loc]) return;
  currentLocale = loc;
  localStorage.setItem('woe_locale', loc);
  applyStaticI18n(document);
  render();            // redesenha tudo no idioma novo
  updateLocaleSwitcherUI();
}

function t(key, params) {
  const dict = LOCALES[currentLocale] || LOCALES['pt-BR'];
  let s = (dict[key] ?? LOCALES['pt-BR'][key] ?? key);   // fallback: locale → pt-BR → chave
  if (params) for (const k in params) s = s.split('{' + k + '}').join(params[k]);
  return s;
}
```

**Regras:**
- **Interpolação por placeholder:** `t('queue.badge', { n: 3 })` → `"Fila #3"`.
  Cobre todos os textos com variável (fila `#N`, badge de leilão "หน้า P · ชิ้น s"
  → "Pág. {p} · {s} un.", contadores, etc.). Usa `split().join()` (não `replaceAll`)
  para compatibilidade ampla e substituição literal segura.
- **`currentLocale` vive FORA do `state`** (padrão idêntico ao `_customMapImages`).
  Garantia: `save()` nunca o serializa no localStorage do `state`, e nenhum listener
  Firebase o sincroniza. Preferência é estritamente por dispositivo.
- **Fallback em cadeia:** locale ativo → pt-BR → a própria chave. Uma chave faltando
  nunca quebra a tela; no pior caso mostra a chave crua (visível e fácil de caçar).
- **Convenção de chaves:** `area.item` em kebab/snake — ex.: `nav.league`,
  `auction.create`, `roster.search_ph`, `common.cancel`, `queue.badge`,
  `wheel.everyone_eligible`. Termos comuns repetidos (`common.save`, `common.cancel`,
  `common.delete`, `common.confirm`) ficam num bloco `common.*` reutilizável.

## 2. Markup estático (`<body>`)

Textos fixos no HTML (título do header, rótulos de aba, diálogos, templates de toast)
recebem atributos:

```html
<button data-i18n="nav.league">League</button>
<input data-i18n-attr="placeholder:roster.search_ph">
<span data-i18n-attr="title:maps.upload_tip">🖼</span>
```

`applyStaticI18n(root)` percorre:
- `root.querySelectorAll('[data-i18n]')` → seta `el.textContent = t(el.dataset.i18n)`.
- `root.querySelectorAll('[data-i18n-attr]')` → para cada par `attr:key` separado por
  vírgula, seta `el.setAttribute(attr, t(key))`. Suporta `placeholder`, `title`,
  `aria-label`, `value`.

Chamado no **boot** (após `load()`, antes/junto do primeiro `render()`) e a cada
`setLocale()`.

> Nota: o texto entre as tags (`League`) é só um placeholder visual no fonte; o valor
> real vem sempre de `t()`. Mantemos um texto pt-BR ali para legibilidade do código.

## 3. Seletor de idioma + troca ao vivo

- Botão **`PT | EN`** no cabeçalho (`<header>`, perto do version stamp / status).
  Dois segmentos clicáveis; o ativo fica destacado (classe `.locale-active`).
- `onclick` → `setLocale('pt-BR')` / `setLocale('en')`.
- `updateLocaleSwitcherUI()` aplica/remove a classe ativa conforme `currentLocale`.
- Troca é instantânea: `applyStaticI18n(document)` + `render()` redesenham sem reload.
- O seletor é visível para **todos** (viewer e admin) — idioma não tem relação com
  permissão. Não é gated por `viewer-mode`.

## 4. Rollout faseado

Cada fase: branch própria → `node test/run.js` verde → `/code-review` → confirmação do
usuário → fast-forward merge em `main`. `APP_VERSION` sobe e `CHANGELOG.md` ganha
entrada **a cada fase** (regra do CLAUDE.md). Cada fase é um spec→plano→implementação
independente; este documento cobre a Fase 0 + Fase 1 e dá o mapa das seguintes.

- **Fase 0 — Motor.** `t()`, `LOCALES` (esqueleto com pt-BR + en), `applyStaticI18n`,
  `setLocale`, seletor no header, persistência, e adaptação do harness de teste
  (`setLocale()` exposto, ver §6). Nenhuma string de tela convertida ainda além do
  próprio seletor → app continua em tailandês, mas o motor existe e o seletor funciona
  (troca o pouco que já estiver com `data-i18n`). Tests verdes.
- **Fase 1 — Telas principais.** header/abas (nav), **League**, **Overrun**, **Roster**,
  **Leilão GL/Overrun**. Converte strings → chaves; popula `LOCALES['pt-BR']` e
  `LOCALES['en']`; atualiza testes que batem nessas telas.
- **Fase 2 — Secundárias.** Summary, Folgas (Leave), Roleta (Wheel), Usuários (Users),
  Pedidos de leilão (auction-request), diálogos, toasts, mensagens de erro/validação.
- **Fase 3 — Varredura final.** `grep` no range Unicode tailandês (`[฀-๿]`)
  para caçar sobras, remover o tailandês remanescente da UI, finalizar `i18n-glossary.md`.

## 5. Jargão e glossário

- Termos de jogo permanecem **literais** no código (não passam por `t()`):
  classes (Knight, Priest, …), itens de leilão (Card, Illusion, White, Black),
  "party"/"GL"/"Overrun"/"WoE". Ficam iguais em pt-BR e en.
- **Fronteira de decisão:** dias da semana, rótulos de UI, botões, títulos de página,
  mensagens → **traduzidos**. Nomes próprios de jogo/itens/classes → **literais EN**.
  `ตี้` (gíria de "party/grupo") será tratado como UI → "Grupo" (pt-BR) / "Party" (en),
  mas isso fica registrado no glossário para o usuário confirmar.
- `docs/i18n-glossary.md`: tabela TH → EN → pt-BR dos termos-chave, entregue para
  revisão. O usuário ajusta a gíria da guild; mudanças refletem no `LOCALES`.

## 6. Impacto nos testes (`test/`)

Hoje há **159 testes** verdes; vários batem em literais tailandeses (ex.: roleta
`"ทุกคนมีสิทธิ์ทุกรอบ"`, fila de pedidos, version stamp).

Estratégia:
- **Fase 0** expõe `setLocale()` no contexto do harness (`harness.js` já faz bridge de
  funções declaradas; `setLocale`/`t` ficam acessíveis). Um helper de teste fixa um
  locale conhecido por bloco (`setLocale('pt-BR')`) para determinismo.
- Asserções de texto migram para:
  1. **Chaves / atributos `data-i18n`** quando possível (mais robusto — independe do
     idioma); ou
  2. O texto pt-BR equivalente quando a asserção precisa do conteúdo renderizado.
- Cada fase que converte uma tela **atualiza no mesmo commit** os testes daquela tela
  (regra do CLAUDE.md: "ห้ามแก้พฤติกรรมแล้วไม่เพิ่ม/อัปเดตเทส"). Lacunas de stub do
  harness são corrigidas em `harness.js`, não contornadas no teste.
- Novo teste de motor (`[i18n]`): `t()` fallback chain, interpolação de placeholder,
  `setLocale` troca o idioma e persiste, chave faltando retorna a chave.

## 7. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Strings interpoladas em `onclick` inline (ex.: wheel `WHEEL_SAFE_KEY_RE`) | `t()` retorna texto puro; manter o escaping existente. Não passar HTML por `t()`. |
| `data-i18n` sobrescrever conteúdo dinâmico de elementos que o JS reescreve | Só anotar markup verdadeiramente estático; elementos render-driven usam `t()` dentro do render, não `data-i18n`. |
| Tradução faltando deixa chave crua na tela | Fallback pt-BR + grep de chaves órfãs antes de cada merge. |
| Texto pt-BR/en mais longo que o TH quebra layout apertado | Smoke test visual por fase; CSS já é flexível, ajustes pontuais se necessário. |
| Testes que batem em TH quebram em massa | Migração de asserções por fase, junto da conversão (§6). |

## 8. Fora de escopo

- Sincronizar idioma entre dispositivos (decisão: por-dispositivo).
- Tradução do jargão de jogo (fica literal EN).
- Qualquer build tooling / framework / dependência npm (proibido pelo CLAUDE.md).
- Outros idiomas além de pt-BR e en.
- Reescrever/refatorar código não relacionado ao i18n.

## 9. Critérios de sucesso (Fase 0 + Fase 1)

- Seletor `PT | EN` no header troca o idioma ao vivo e persiste no reload (por dispositivo).
- League, Overrun, Roster e Leilão GL/Overrun aparecem 100% em pt-BR (padrão) e em inglês,
  sem tailandês visível nessas telas.
- `node test/run.js` verde, incluindo a nova suíte `[i18n]`.
- `/code-review` sem findings de correção em aberto.
- `APP_VERSION` atualizado + entrada no `CHANGELOG.md` por fase.
- `docs/i18n-glossary.md` criado com os termos das telas convertidas.
