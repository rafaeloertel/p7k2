# Bancadas do Hub

Rodam sobre o build (`dist/flat`), com Supabase e Microsoft falsos: nada sai da máquina e nenhum dado real entra.

Preparação (uma vez):

    pip install playwright && python3 -m playwright install chromium
    mkdir -p /home/claude/vendor && cd /home/claude/vendor && npm init -y && npm install chart.js@4.4.1 chartjs-plugin-datalabels@2.2.0

(Ou outra pasta, informada em `HUB_VENDOR`.) O Chart.js tem de ser o de verdade: um Chart falso escondeu erro de tela na primeira rodada da `t_telas.py`.

| Bancada | O que prova |
|---|---|
| `t_reauth.py` | v0.16.3: depois de "Esqueci o código", "Sair da conta" ou 5 erros, o login vai com `prompt=login`; login comum não. Contra a v0.16.2 dá 16/23 (controle). |
| `t_telas.py` | As 23 telas em computador e celular, claro e escuro: sem erro de JS, sem faixa "Não foi possível abrir esta tela", sem rolagem lateral a 390 px. Segundo argumento opcional: pasta para prints. |

Ainda não reescritas (perdidas com o contêiner em 25/11): as 48 verificações da trava (`t_pin.cjs`, com autenticador virtual do CDP para o Face ID).
