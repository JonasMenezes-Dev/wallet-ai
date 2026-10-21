# Wallet AI Premium 2.0 — fundação

Referência: [Wallet AI · Premium 2.0 · todas as telas](https://www.figma.com/design/U4DFroIQnftdD9YH5cMcv4?node-id=4-2). Tokens extraídos de Início (5:2) e Novo lançamento (5:533). As 14 telas serão migradas na etapa 2; esta etapa prepara as primitivas e adapta o card de metas compartilhado.

## Tokens e compatibilidade

- `src/theme`: APIs existentes preservadas. Escuro: fundo `#091611`, superfície `#11241C`, borda `#294B3B`, esmeralda `#51D9A0`, texto `#E9F7ED`, secundário `#9BAFA3`. Claro usa equivalentes com contraste; `light`, `dark` e `system` continuam disponíveis, com a mesma persistência.
- `spacing`: escala existente de 2 a 48. Conteúdo de cards 20, margem de tela recomendada 24, espaçamento entre seções 24–32.
- `radii`: cards/campos 21, botões 14, seletores 10. `elevation.card`: sombra e elevação discretas.
- `typography`: Inter local regular/negrito via `expo-font` já instalado. Título 29, destaque monetário 32, seção 18, corpo 14, rótulo 11. Fonte ampliada permanece habilitada. Não se aplicam estilos globais aos componentes legados.
- Botões: altura mínima 52; campos 55; seletores e botões de ícone respeitam alvo de toque mínimo 44, ainda que a referência desenhe chips menores.

## Componentes

| Componente | Uso na etapa 2 |
| --- | --- |
| `AppText` | Variantes `body`, `caption`, `label`, `subtitle`, `title`, `amount`; tons semânticos; valores monetários com algarismos tabulares. |
| `AppCard` | API atual preservada (`muted`, `padded`, `style`), com `ambient="subtle"` ou `"highlight"` para saldo, metas e relatórios. Padrão sem textura. |
| `AppButton` | Primário/secundário/ghost, ícone opcional, desabilitado e `loading`; durante carregamento anuncia ocupado, mostra indicador e bloqueia callback. |
| `AppField` | Props nativas de TextInput, `label`, `hint`, `error`, `containerStyle`; foco destacado, erro anunciado. Não converte valores, não substitui validação financeira. |
| `AppSelector` | Grupo de opções controladas com valores string/número, `onChange`, opção/grupo desabilitado e seleção anunciada. |
| `ScreenHeader` / `SectionHeader` | Contratos existentes, hierarquia e fonte compartilhadas. |
| `AppState` | `empty`, `loading`, `success`, `error`, título, descrição e ação opcional. Não substitui tratamento de erros dos serviços. |
| `WalletSymbol` | API anterior e ícones vetoriais locais do Figma para navegação, entradas, saídas e insights; demais símbolos usam `expo-symbols` já instalado. Sem emojis de fallback. |
| `PremiumAmbient` | Decoração absoluta, estática, oculta para leitores de tela e sem interceptar toques. |
| `PremiumScreen` | View flexível com superfície temática e ambientação. A tela continua responsável por scroll, safe areas, teclado e navegação. |

```tsx
<PremiumScreen ambient="subtle">
  {/* Manter aqui o container/scroll/safe area já usado pela tela. */}
  <ScreenHeader eyebrow="Movimentações" title="Nova transação" />
  <AppField label="Valor" value={amount} onChangeText={setAmount}
    keyboardType="decimal-pad" error={amountError} />
  <AppButton label="Salvar transação" onPress={save} loading={saving} />
</PremiumScreen>

<AppCard ambient="highlight">
  <AppText variant="label" tone="muted">Patrimônio total</AppText>
  <AppText variant="amount">{formattedBalance}</AppText>
</AppCard>
```

Os SVGs em `assets/premium` são exports originais, sem dependência de URLs temporárias. Dimensões originais: topografia 697,433×949,705, sobre canvas 390×844 em x=-149/y=-34,355; arcos 390×320 em y=112. A escala mantém proporções conforme a largura. `subtle` aplica 4% às linhas, `standard` 6%, `highlight` 7%. Os arcos têm 5,5% embutidos no SVG e só aparecem em destaque. Em cards, a geometria é recortada nas bordas, atrás dos filhos. Formulários/configurações devem usar `subtle`.

## Ícone Android

`assets/wallet-icon.png` permanece intacto. O novo `wallet-adaptive-foreground.png` reenquadra a arte original em um recorte quadrado centrado no símbolo, preservando cores, tile e textura. `app.json` aponta o adaptive icon para esse asset. Não mudam versão 1.0.2, versionCode 3, applicationId, splash ou assinatura.

O teste verifica o centro da marca e sua inclusão no círculo seguro de 66dp em uma camada de 108dp, conforme a [documentação Android](https://developer.android.com/develop/ui/compose/system/icon_design_adaptive). A textura/tile decorativo pode ser recortada pela máscara do launcher.

Reprodução dos assets, sem prebuild ou APK:

```powershell
python scripts/generate-android-icon.py
# Apenas para um diretório android já existente:
python scripts/generate-android-icon.py --sync-native
```

O segundo comando atualiza somente mipmaps de launcher existentes em `android/app/src/main/res` (diretório gerado e ignorado pelo Git). Recursos nativos da beta não são recriados. Pillow já era usado pelo utilitário de ícones original; nenhuma dependência JavaScript foi acrescentada. A fonte Inter mantém a licença em `assets/fonts/Inter-OFL.txt`, com arquivos estáticos do projeto [Expo Google Fonts](https://github.com/expo/google-fonts/tree/master/font-packages/inter).

## Verificação

```powershell
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js .
node --experimental-strip-types --test tests/premium-components.test.mjs tests/android-icon.test.mjs tests/card-payment-ui.test.mjs
```

Esses comandos diretos evitam as restrições de execução do npm.ps1 neste Windows. Validar em dispositivo quando a próxima compilação for autorizada: temas claro/escuro/sistema, escala de fonte, foco/erro, carregamento, legibilidade e enquadramento do launcher em máscaras circular e squircle. Nenhum APK é gerado nesta etapa.
