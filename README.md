# Wallet.ai — Beta 0.2

Aplicativo pessoal de finanças para Android, com armazenamento local SQLite. As funções principais continuam funcionando sem backend próprio.

## Funcionalidades

- Contas, cartões e limite de crédito.
- Registro e consulta local de transações.
- Metas e aportes.
- Dashboard com resumos calculados a partir do banco local.
- Orçamentos mensais por categoria.
- Contas recorrentes e previsão de fluxo de caixa.
- Relatórios mensais com comparação e despesas por categoria.
- Alertas no app para limites de orçamento e contas próximas/vencidas.
- Importação revisada de notificações financeiras compatíveis no Android.

## Privacidade e limitações

- Os dados de cada instalação ficam separados no próprio dispositivo; não existe sincronização entre celulares.
- Desinstalar o app pode apagar os dados locais. Faça backup antes de remover ou reinstalar.
- A importação de notificações exige permissão explícita do Android e funciona apenas em APK compilado com o módulo nativo, não no Expo Go nem na versão web.
- A captura é filtrada localmente para uma lista de aplicativos bancários e termos financeiros conhecidos. O formato varia por banco; algumas notificações podem não conter o valor e não serão importáveis.
- O Wallet mostra os dados extraídos para revisão. Confirme conta, categoria, tipo e valor antes de registrar.
- Os alertas de orçamento e vencimento estão disponíveis dentro do app nesta versão; notificações do sistema em segundo plano podem ser adicionadas depois.
- Open Finance real ainda não está integrado.
- Fatura, fechamento e vencimento de cartão ainda não fazem parte da versão atual.
- Atualizações remotas exigem configuração e publicação próprias no EAS Update; não são automáticas só por enviar código ao GitHub.

## Desenvolvimento

Requer uma versão de Node.js compatível com o Expo SDK do projeto.

```bash
npm ci
npm run typecheck
npm run lint
```

## Gerar APK de teste para Android

1. Instale/entre na CLI do EAS: `npx eas-cli login`.
2. Verifique a configuração: `npx eas-cli project:info`.
3. Gere o APK: `npx eas-cli build --platform android --profile preview`.
4. Quando o build terminar, abra o link fornecido pelo EAS no celular e instale o APK.
5. Para testar a leitura, abra **Importar notificações bancárias**, ative o acesso nas configurações do Android e volte ao Wallet. Faça uma movimentação de teste em um banco compatível, confira os dados extraídos e confirme o lançamento.
6. Teste também orçamento acima de 80%/100%, contas recorrentes com vencimento próximo e relatórios de meses com dados conhecidos.

Não compartilhe o APK publicamente enquanto não concluir os testes em dispositivo real. Use dados de teste inicialmente; este app não substitui extratos oficiais da instituição financeira.
