# WoE Event Bot

Avisa no **grupo do WhatsApp da guild** (e opcionalmente no Discord) os eventos
do dia do Ragnarok Origin Classic, em horário de Brasília:

- **09:00** — resumo do dia (eventos + leilões de carta)
- **10 min antes** de cada evento e de cada leilão (13h / 17h / 20h30) — lembrete

O calendário do jogo (UTC-4) já está convertido para BRT em `EVENTS` no
`index.js`; os leilões diários ficam em `AUCTIONS` — edite lá quando o jogo
mudar a grade.

## ⚠️ Aviso

Usa `whatsapp-web.js` (**não-oficial** — automatizar WhatsApp viola os termos
de uso e pode **banir o número**). Use um número secundário/descartável, nunca
o principal. O número precisa estar (ou vai entrar via convite) no grupo.

## Setup (uma vez)

```bash
cd bot
npm install
node index.js --test   # self-check da lógica de horários
node index.js          # escaneie o QR com o WhatsApp do número do bot
```

A sessão fica salva em `bot/.wwebjs_auth/` — nas próximas execuções não pede QR.

## Rodando 24/7

O bot precisa estar rodando na hora dos avisos (PC ligado). Para iniciar junto
com o Windows: Agendador de Tarefas → nova tarefa "Ao fazer logon" →
`node C:\Users\soste\Documents\one-o-clock-woe\bot\index.js`.

## Espelhar no Discord (opcional)

```powershell
$env:DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/..."
node index.js
```

Crie um webhook no canal desejado (Configurações do canal → Integrações →
Webhooks) e use a URL. Não commite a URL no repo.
