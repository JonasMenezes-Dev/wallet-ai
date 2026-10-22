# Wallet AI Premium 2.0 — beta Android

Versão 2.0.0, versionCode 4, package `com.walletai.app`. Perfil EAS `preview`: distribuição interna, APK standalone (`developmentClient: false`), credenciais remotas existentes, `--freeze-credentials`. Runtime de atualizações acompanha a versão do app; nenhum conteúdo de notificações é enviado pelo fluxo de captura.

## Evidências locais

- Suíte completa: **312 testes aprovados**, sem falhas, incluindo saldos, transferências, cartões, metas, recorrências, orçamentos, migrações/persistência, captura, confirmação/reinício, deduplicação, filtros e ícone.
- TypeScript e ESLint: aprovados.
- Testes Kotlin puros de autorização, catálogo e privacidade: **15 aprovados**, compilados com o compilador local.
- Emissor fictício: Java compilado contra Android API 36. Ainda não representa execução/captura no aparelho.
- Gradle release local: tentativa parou no autolinking Windows (`android/settings.gradle`, processo cmd), antes da compilação do módulo. Resultado da compilação completa será o build EAS; não se declara compilação nativa aprovada com base apenas no JVM.
- Contextos e limites da migração visual: [etapa 1](premium-design-system.md), [etapa 2](premium-stage2.md).

## Descontinuação na versão 2.1

A captura e sua central foram removidas na Etapa 1. As evidências acima descrevem exclusivamente a beta 2.0. Consulte [migração financeira 2.1](FINANCIAL_V2_STAGE1.md) para o comportamento atual.

## APK e GitHub

Artefato oficial e resultado do build serão registrados aqui após a geração. A branch de entrega é `feat/premium-redesign`, preservando b941ecf, 5d52323 e a base e09f795 da PR #15. Sem merge automático. PRs #11/#14 têm divergência histórica e não devem ser encerradas ou sobrescritas sem revisão própria.

## Validação em aparelho real pendente

Instalar por cima da versão anterior somente com a mesma assinatura; nunca desinstalar para contornar conflito de assinatura, pois isso pode apagar o banco. Fazer primeiro cópia de segurança pelo procedimento já validado pelo usuário, se disponível; não se promete backup/restauração implementado.

Verificar início sem Metro, migração preservando dados, fluxos Premium, teclado/safe areas/fontes ampliadas, animações e persistência ao reiniciar. Na 2.1 conferir ausência da captura, os saldos livre/reservado e os resgates.
