# Emissor fictício de notificações — desenvolvimento

Aplicativo Android independente: `com.walletai.notificationfixture`. Emite cenários fictícios de Pix, débito, crédito, wallet/NFC, estorno, mensagem incompleta, OTP, promoção e um par banco + wallet. Sem rede, dependências de runtime, dados de bancos ou gravação de transações.

Somente a variante debug é habilitada. O pacote de testes só aparece quando o Wallet é Android **debuggable** e o emissor está instalado; não integra o [catálogo financeiro de produção](../../docs/supported-notification-apps.md). A preferência continua desligada por padrão. A leitura nativa ignora a autorização fictícia em produção, mesmo se existir configuração persistida de debug; a gravação também a rejeita.

## Instalação manual no emulador

Execute na raiz do Wallet. O SDK Android 36 já está instalado neste ambiente. Reutilize o JDK, AGP 8.12.0 e wrapper Gradle existentes; nenhum comando abaixo foi executado pelo agente. `--offline` evita downloads; se faltar algum artefato no cache, pare e revise antes de autorizar downloads.

```powershell
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
.\android\gradlew.bat -p .\tools\notification-fixture --offline assembleDebug
& "$env:ANDROID_HOME\platform-tools\adb.exe" -e install -r .\tools\notification-fixture\build\outputs\apk\debug\notification-fixture-debug.apk
& "$env:ANDROID_HOME\platform-tools\adb.exe" -e shell am start -n com.walletai.notificationfixture/.MainActivity
```

`-e` seleciona o emulador (deixe apenas um em execução). O emissor solicita `POST_NOTIFICATIONS` somente ao tocar em um cenário; após conceder, toque novamente. Não emite nada ao abrir.

O emissor limpa suas notificações anteriores antes de cada cenário para evitar [resumos automáticos de agrupamento](https://developer.android.com/develop/ui/views/notifications/group). Cada cenário mantém uma notificação ativa, ou duas no par banco + wallet. Isso não remove eventos já persistidos na fila do Wallet.

**Atualize também o development build do Wallet**, pois a ponte, o serviço e o manifesto debug mudaram. Use o fluxo de recompilação/reinstalação já validado (`npx expo run:android`, manualmente). Apenas recarregar o JavaScript não incorpora alterações nativas. Para validar somente o Kotlin:

```powershell
.\android\gradlew.bat -p .\android :wallet-notification-listener:compileDebugKotlin
```

## Roteiro de captura e autorização

1. No Wallet, abra Configurações → Notificações financeiras. A instalação do emissor não autoriza nada e não ativa a captura.
2. Conceda o acesso de notificações do Android, selecione explicitamente **Wallet AI · notificações fictícias** e só então ative a captura interna. Para isolar o teste, deixe apenas o emissor selecionado.
3. O diagnóstico de desenvolvimento aparece abaixo da seleção. Anote o **Total persistido** inicial; use deltas porque a fila pode conter eventos de testes anteriores.
4. Abra o emissor pelo launcher, deixando o Wallet em segundo plano. Sem marcar reentrega, toque uma vez em cada um dos quatro botões.
5. Volte ao Wallet e toque **Atualizar contagens**. Espere total **+4**, normalmente em `received`. Se a gravação nativa ainda estiver terminando, atualize novamente. O diagnóstico consulta somente agregados do emissor; não retorna nem descriptografa títulos, textos, identidades ou valores.
6. Para testar o processo React sem o Wallet em primeiro plano, volte à tela inicial e mantenha o emissor em primeiro plano. Opcionalmente, com o Wallet já em segundo plano:

```powershell
& "$env:ANDROID_HOME\platform-tools\adb.exe" -e shell am kill com.walletai.app
```

Envie outro evento e reabra o Wallet. Espere total **+1**. `am kill` só mata processos elegíveis em segundo plano: esse passo não prova que o processo foi encerrado. **Não use `am force-stop`**: o Android suspende o pacote e seu listener; isso não é equivalente a segundo plano.

7. Desmarque a autorização do emissor no Wallet. Se era o único aplicativo, a captura é desativada. Envie mais um evento no emissor; espere delta **0**. Os eventos anteriores continuam na fila.
8. Selecione o emissor novamente: a captura deve continuar desligada até você ativá-la explicitamente. Com captura ativa, revogue o acesso em **Gerenciar acesso no Android**, volte ao Wallet e confira o estado separado de permissão. Envie outro evento: delta **0**. A captura interna pode permanecer configurada como ativa, mas deve aparecer pausada sem o acesso do sistema.

## Cenários adicionais

Envie um cenário por vez, sem a opção de reentrega. Confira os deltas no diagnóstico e a revisão no Wallet. As expectativas abaixo descrevem o comportamento desejado para validação manual; não representam execução em dispositivo.

| Botão | Dado fictício | Expectativa de captura/revisão |
| --- | --- | --- |
| Pix enviado / recebido | R$ 12,34 / R$ 56,78 | Uma captura por toque; confirmar somente após revisão explícita. |
| Débito / crédito | R$ 23,45 / R$ 67,89 | Uma captura por toque; modalidades distintas, sem gravação financeira automática. |
| Wallet / NFC simulado | R$ 45,67 | Uma captura; nenhuma comunicação NFC ocorre. |
| Estorno | R$ 23,45 | Uma captura; nunca tratar silenciosamente como nova compra. |
| Compra incompleta | Sem valor | Uma captura; não inferir valor nem registrar automaticamente. |
| OTP fictício | Código 123456 | **Zero capturas persistidas**, bloqueado pelo filtro nativo antes de inserir na fila. |
| Promoção | Desconto fictício de R$ 10,00 | Pode entrar na fila; não é uma compra confirmável automaticamente. |
| Par banco + wallet | Mesma referência DEMO-PAR-01, R$ 34,56 | Dois eventos Android distintos; devem continuar sujeitos à revisão e a proteção contra dupla confirmação. |

Todas as notificações mantêm o pacote verdadeiro `com.walletai.notificationfixture`. O par identifica **origem simulada** no texto e na extra `wallet.fixture.simulated_source` (`bank` / `wallet`); o listener ignora essa extra ao determinar `source` e autorização. Não há spoof de pacotes nem alteração da origem persistida. Esse par não prova deduplicação real entre dois pacotes financeiros; permite exercitar o texto e o fluxo de revisão com identificação explícita da simulação. A referência fixa é fictícia; use um único par por verificação.

Instalar o emissor ou ampliar o catálogo nunca o autoriza. Em release, mesmo uma notificação com extras de simulação e configuração antiga debug continua bloqueada. Os cenários não demonstram que Google Wallet, Samsung Wallet ou outro app real emita notificações com os mesmos campos.

## Duplicação controlada

Marque **Reentregar o mesmo evento** no emissor e toque em um dos quatro cenários uma vez. O serviço debug autorizado persiste o `InboxCapture` duas vezes com **a mesma identidade Android, mesmo postTime e mesmo conteúdo**, usando a fila e a criptografia reais. A segunda chamada precisa retornar o mesmo ID local.

Resultado esperado: total **+1**, **Duplicações verificadas nesta sessão +1**, **Falhas +0**. Repita após reabrir o Wallet para conferir persistência das contagens da fila. O contador de verificações é apenas em memória e reinicia com o processo nativo.

Dois toques normais são **dois eventos novos**, com identidades/horários próprios, e devem adicionar duas linhas, mesmo quando os textos fictícios são iguais. Repostar uma notificação não garante o mesmo `postTime`; por isso o teste de duplicação usa reentrega controlada, não dois `notify()`.

## Testes locais

Sem dispositivo: os testes Kotlin cobrem autorização explícita, bloqueio de configuração debug em produção, falhas, revogação, expansão do catálogo sem autorização implícita e rejeição de conteúdo de OTP/credenciais. O teste SQLite executa o SQL real da fila e preserva uma única linha para a identidade duplicada após reabrir o banco. Os testes TypeScript aceitam somente contagens e estados no diagnóstico e exigem seleção explícita de wallets instaladas.

```powershell
node --experimental-strip-types --test tests/notification-capture-settings.test.mjs
node --test --test-name-pattern 'fixture duplicate' tests/native-notification-inbox.test.mjs
```

Os testes SQLite usam blobs opacos: não executam Android Keystore. Instalação, manifesto mesclado, captura real, segundo plano e revogação no emulador continuam sendo validações manuais. Não há logs de conteúdo nem migração/limpeza automática da fila.
