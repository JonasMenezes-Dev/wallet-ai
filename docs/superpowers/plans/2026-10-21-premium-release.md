# Premium 2.0 — captura ampliada e beta Android

**Objetivo:** ampliar reconhecimento/captura sem gravação financeira automática, validar regressão e entregar APK preview assinado de com.walletai.app.
**Base:** feat/premium-redesign, commits b941ecf e 5d52323 preservados. Incorporar fontes locais da beta ainda não versionadas, sem caches/diagnósticos/chaves.

- [ ] Reconhecimento local conservador: débito/crédito/Pix/transferência/estorno, contexto de aproximação/online/presencial, valores BRL inteiros em centavos; estados incompletos/ambíguos e rejeição de promoções/segredos.
- [ ] Catálogo de package names verificado em fontes primárias, queries Android específicas, autorização configurável/off por padrão, filtro de conteúdo sensível antes da persistência criptografada; ampliar emissor fictício sem falsificar origem de apps reais.
- [ ] Defesa persistente e transacional contra possível duplicação de confirmações diferentes: bloquear novo lançamento suspeito e manter revisão, preservar replay idempotente e recuperação por recibos.
- [ ] Adaptar resumos/UI à nova operação e aos metadados opcionais; manter postedAt/data/hora editável e confirmação explícita.
- [ ] Suíte completa, TypeScript, ESLint, testes JVM e compilação nativa; corrigir regressões; documentação/README/CHANGELOG e versão instalável superior ao code3.
- [ ] Commit e push sem force; verificar PRs e divergência remota sem merge automático.
- [ ] EAS preview standalone com --freeze-credentials; verificar APK/assinatura/manifest/bundle e, se possível, início sem Metro em emulador isolado. Nenhum dado do app existente será apagado.

## Limites obrigatórios

Notificação reconhecida é candidato, não pagamento comprovado. Carteiras/NFC só entram se publicarem notificação acessível e houver autorização. Testes usam conteúdo fictício e não demonstram compatibilidade bancária real. Não transmitir notificações, OTPs ou dados pessoais a servidores; upload EAS contém somente fontes/fixtures fictícias, sem banco de dispositivo. A defesa heurística de duplicidade deixa casos suspeitos pendentes e pode bloquear compras distintas de mesmo valor próximas; nunca funde nem descarta automaticamente eventos.

Versão pretendida: 2.0.0 beta, versionCode mínimo4, confirmar último build remoto antes de definir. Manter assinatura remota existente, package e histórico.
