# Wallet AI Premium 2.0 — etapa 1

**Objetivo:** preparar componentes reutilizáveis e corrigir o enquadramento do ícone, preservando a beta 1.0.2 e a lógica financeira.

**Referência aprovada:** Figma U4DFroIQnftdD9YH5cMcv4, página 4:2. Início 5:2 e formulário 5:533 fornecem cores, hierarquia, controles e geometria. Esta etapa não implementa as 14 telas.

**Arquitetura:** manter ThemeProvider, contratos existentes e dependências Expo/React Native. Acrescentar primitivas em src/components e tokens semânticos em src/theme. Usar SVGs originais locais via expo-image; fundos estáticos sem eventos de toque. Gerar foreground Android separado a partir da marca existente, sem mudar versão ou identidade do pacote.

## Execução

- [x] Adaptar paletas e tokens; manter claro, escuro e sistema e APIs atuais.
- [x] Evoluir AppButton/AppCard/cabeçalhos; criar AppText, AppField, AppSelector e AppState. Preservar callbacks e estados desabilitados, anunciar erros e carregamento.
- [x] Criar PremiumAmbient e PremiumScreen, com geometria recortada nas bordas, opacidade 4–7%, sem animação contínua ou interceptação de toque. Preparar destaque em cards e trocar emojis do card de metas por símbolos vetoriais.
- [x] Corrigir foreground Android e configuração Expo, com gerador reproduzível e teste de área segura/centralização. Atualizar somente recursos locais de launcher já gerados, sem prebuild ou APK.
- [x] Executar verificações finais; preparar commit apenas dos arquivos desta etapa.

## Registro

- Base: e09f795, última beta disponível em origin/feat/beta-release-candidate após fetch. Branch inicial feat/beta-release-candidate estava um commit atrás (somente README); alterações locais foram carregadas para feat/premium-redesign.
- 239 arquivos locais anteriores registrados por SHA-256 e conferidos sem alterações.
- Revisão independente encontrou apenas alvo mínimo horizontal no seletor, corrigido para 44.
- TypeScript, ESLint e 12 testes pertinentes aprovados na execução intermediária. Ícone conferido visualmente com guia circular de área segura. Não há navegador disponível na sessão; conferência das primitivas em dispositivo fica registrada como validação manual, sem alegar teste visual do app.
- Execução final: TypeScript e ESLint sem erros; 12/12 testes aprovados, incluindo pagamento de cartão existente; 10 SVGs e 15 assets nativos de launcher verificados. Sem builds, APK, merge ou push.

## Validação e riscos

- Botão carregando não dispara ações; campos preservam entrada e callbacks, inclusive campos monetários sem qualquer formatação automática.
- Seletores preservam valores genéricos e ignoram opções desabilitadas.
- Texturas não entram na árvore de acessibilidade nem capturam toques; conteúdo flexível e fontes ampliadas continuam livres para crescer.
- Ícone centralizado dentro da área segura Android em máscaras circular e quadrada; original preservado.
- Sem alterações em banco, serviços financeiros, importação de notificações, assinatura ou applicationId. Alterações locais anteriores ficam fora do commit.
