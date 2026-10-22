# Fontes de notificações financeiras

Catálogo de descoberta Android, conferido em 21/10/2026 nas páginas dos respectivos publicadores no Google Play. O identificador é o parâmetro `id` do link; os nomes da loja podem variar por idioma e país. `SupportedNotificationApps.kt` e `<queries>` do manifesto mantêm os mesmos 12 identificadores exatos. A consulta usa `getApplicationInfo` apenas para esse catálogo; não há enumeração geral de aplicativos nem `QUERY_ALL_PACKAGES`.

| Aplicativo | Package ID e fonte primária |
| --- | --- |
| Banco do Brasil | [br.com.bb.android](https://play.google.com/store/apps/details?id=br.com.bb.android) |
| Bradesco | [com.bradesco](https://play.google.com/store/apps/details?id=com.bradesco) |
| Inter | [br.com.intermedium](https://play.google.com/store/apps/details?id=br.com.intermedium) |
| Itaú | [com.itau](https://play.google.com/store/apps/details?id=com.itau) |
| Nubank | [com.nu.production](https://play.google.com/store/apps/details?id=com.nu.production) |
| Santander | [com.santander.app](https://play.google.com/store/apps/details?id=com.santander.app) |
| Google Wallet | [com.google.android.apps.walletnfcrel](https://play.google.com/store/apps/details?id=com.google.android.apps.walletnfcrel) |
| Samsung Wallet | [com.samsung.android.spay](https://play.google.com/store/apps/details?id=com.samsung.android.spay) |
| PicPay | [com.picpay](https://play.google.com/store/apps/details?id=com.picpay) |
| Mercado Pago | [com.mercadopago.wallet](https://play.google.com/store/apps/details?id=com.mercadopago.wallet) |
| PagBank | [br.com.uol.ps.myaccount](https://play.google.com/store/apps/details?id=br.com.uol.ps.myaccount) |
| RecargaPay | [com.recarga.recarga](https://play.google.com/store/apps/details?id=com.recarga.recarga) |

As páginas identificam o aplicativo e o publicador; não demonstram compatibilidade dos textos de notificações com o interpretador. Nenhum evento de aplicativo financeiro real foi usado como evidência nesta alteração. Incluir um pacote no catálogo não garante que ele publique notificações de compra, exponha seu conteúdo ao listener ou informe valor, modalidade e estabelecimento. Não se presume que uma compra NFC gere notificação. Isso depende de app, configuração, emissor, aparelho e versão Android. Não há captura direta de NFC, do cartão, extrato ou rede.

A captura continua desligada e sem pacotes por padrão. Atualizar o catálogo ou instalar um aplicativo não amplia uma seleção existente. São necessários acesso Android, seleção explícita de aplicativos instalados e ativação interna. A ponte conserva o nome `getInstalledBankApps` para compatibilidade; seus resultados agora incluem os apps financeiros acima. Isso não cria autorização implícita nem autoriza qualquer pacote arbitrário. A lista permanece local e a alteração não adiciona envio pela rede.

O worker verifica autorização antes de ler título/texto e novamente antes da persistência, usando o mesmo lock da revogação e a revisão de autorização. O filtro puro `NotificationContentPrivacy` rejeita mensagens contendo indicadores de OTP, senha, PIN, token, código, autenticação, credencial, login identificado ou número completo de cartão, inclusive quando misturados a uma compra. Normaliza acentos, caracteres invisíveis e espaços. O filtro é conservador e pode descartar avisos financeiros que contenham essas palavras; `código de barras` comum é uma exceção. Ele não é prova de reconhecimento de todas as formulações ou idiomas. Conteúdo rejeitado não é inserido nem registrado em log. O armazenamento autorizado remanescente usa a mesma fila criptografada e não cria transações automaticamente.

O emissor `com.walletai.notificationfixture` existe apenas no catálogo e visibilidade debug. A autorização persistida desse pacote é removida em runtime release e sua seleção é rejeitada fora de desenvolvimento. O app emissor só possui variante debug; nenhuma extra de notificação altera essa barreira. Consulte [o roteiro do emissor fictício](../tools/notification-fixture/README.md) para as simulações e os limites de evidência.
