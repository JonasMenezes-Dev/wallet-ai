# Wallet.ai — Beta 0.1

Aplicativo pessoal de finanças para Android, com armazenamento local SQLite. A versão beta não exige backend próprio para cadastro de contas, transações e metas.

## O que funciona sem servidor próprio

- Contas, cartões e limite de crédito.
- Registro e consulta local de transações.
- Metas e aportes.
- Dashboard e resumos calculados a partir do banco local.
- Os dados de cada instalação ficam separados no próprio dispositivo.

## Limitações atuais do beta

- Os dados não são sincronizados automaticamente entre celulares.
- Desinstalar o app pode apagar os dados locais. Faça backup antes de remover ou reinstalar.
- Open Finance real e leitura automática de notificações bancárias em segundo plano não são considerados disponíveis apenas por existir código de preparação para essas fontes.
- Fatura, fechamento e vencimento de cartão não fazem parte desta versão.
- Atualizações remotas do app exigem configuração e publicação próprias no EAS Update; não são automáticas só por enviar código ao GitHub.

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
5. Teste criação/edição/exclusão de contas, transações e metas, feche e reabra o app e repita o teste sem internet.

Não compartilhe o APK publicamente enquanto não concluir os testes em dispositivo real. Cada pessoa que instalar terá o próprio banco local.

## Checklist antes de chamar de beta

- [ ] `npm ci` conclui sem erro.
- [ ] `npm run typecheck` passa.
- [ ] `npm run lint` passa sem novos erros.
- [ ] APK preview gera sem erro.
- [ ] App abre sem Metro, Expo Go ou servidor local.
- [ ] Dados persistem depois de fechar e reabrir.
- [ ] Fluxos financeiros básicos foram testados com valores conhecidos.
- [ ] Backup/restauração foi definido antes de guardar dados importantes.
- [ ] Nenhuma credencial, chave privada ou segredo foi commitado.

## Privacidade e beta

Use dados de teste inicialmente. Este app ainda não deve ser tratado como sistema bancário oficial ou como substituto de extratos fornecidos pela instituição financeira.
