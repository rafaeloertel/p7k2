# src

Fonte do site publicado na raiz deste repositório. A raiz recebe só o build; esta pasta é a origem dele.

    python3 tools/build-flat.py      # gera dist/flat/ com os 11 arquivos da raiz (inclui .nojekyll)
    python3 tools/comparar.py ..     # confere, byte a byte, que o build é igual ao publicado

- Editar aqui, nunca no `index.html` da raiz. Correção feita direto na raiz tem de voltar para cá no mesmo dia.
- Versão em dois lugares: `js/core.js` (`version`) e `sw.js` (`VER`); o build recusa se divergirem.
- Bancadas em `tests/` (ver `tests/LEIA-ME.md`).
- A rotina agendada fica em `/.github/workflows/` na raiz do repositório, não aqui.
