# Plano de testes — Wallet.ai Beta

**Objetivo:** validar os fluxos essenciais no APK Android antes de considerar uma distribuição mais ampla.

> O teste é manual. Marque um item como concluído somente depois de observar o comportamento no dispositivo. Use dados de teste e confira valores com uma fonte independente.

## 1. Instalação e persistência

- [ ] APK instala e abre sem travar.
- [ ] Navegação entre as telas principais funciona.
- [ ] Fechar e abrir o app mantém os dados cadastrados.
- [ ] Aparência clara/escura e legibilidade estão aceitáveis.
- [ ] Atualizar instalando o APK por cima mantém os dados existentes.
- [ ] Confirmar que os dados de uma instalação não aparecem automaticamente em outro celular.

## 2. Contas e movimentações

- [ ] Criar uma conta com saldo inicial de R$ 100,00.
- [ ] Registrar uma despesa de R$ 20,00 e conferir saldo de R$ 80,00.
- [ ] Editar a despesa para R$ 30,00 e conferir saldo de R$ 70,00.
- [ ] Excluir a despesa e conferir retorno a R$ 100,00.
- [ ] Registrar uma entrada de R$ 15,00 e conferir saldo de R$ 115,00.
- [ ] Tentar uma despesa acima do saldo e confirmar o comportamento esperado sem lançamento indevido.
- [ ] Conferir valores, datas, categorias e tipos na lista de movimentações.

## 3. Cartões

- [ ] Criar um cartão com limite de R$ 1.000,00.
- [ ] Registrar uma compra de R$ 200,00 e conferir R$ 800,00 disponíveis, se esse fluxo estiver habilitado.
- [ ] Editar ou excluir a compra e conferir se o limite é recalculado corretamente.
- [ ] Registrar qualquer limitação ou divergência relacionada à fatura e ao ciclo do cartão.

## 4. Metas e aportes

- [ ] Criar uma meta.
- [ ] Fazer um aporte e verificar a atualização do valor guardado e do saldo da conta.
- [ ] Editar ou excluir o aporte e conferir se os valores relacionados são corrigidos sem duplicação.

## 5. Orçamentos, recorrências e relatórios

- [ ] Criar orçamento mensal para uma categoria e registrar despesas nessa categoria.
- [ ] Conferir o comportamento perto de 80% e ao atingir/exceder 100% do orçamento.
- [ ] Conferir contas recorrentes próximas do vencimento e vencidas.
- [ ] Comparar um relatório com um conjunto de movimentações conhecido.
- [ ] Conferir totais mensais e despesas por categoria.
- [ ] Testar mês sem movimentações e mês com entradas e despesas.

## 6. Atualização 2.1 e reservas

- [ ] Atualizar a instalação existente com a mesma assinatura e preservar contas, cartões, metas, recorrências, orçamentos e transações confirmadas anteriormente.
- [ ] Verificar ausência da tela e do acesso especial para captura bancária, mantendo os alertas próprios.
- [ ] Com conta de R$ 100 e meta zerada: aportar R$ 40 deve resultar em R$ 60 livres, R$ 40 reservados, patrimônio de R$ 100 e nenhuma receita/despesa nova.
- [ ] Resgatar R$ 15 e depois R$ 25: saldo livre volta a R$ 100, reserva a zero, sem receita nova.
- [ ] Editar e excluir aportes/resgates no histórico; estorno sem fundos deve ser recusado sem alterar dados.
- [ ] Conferir aportes/resgates separados de consumo nos relatórios e persistência após reiniciar.

## 7. Registro dos resultados

Para cada falha, anote:
- aparelho e versão do Android;
- versão do app (em beta);
- passos para reproduzir;
- resultado esperado e resultado observado;
- captura sem dados pessoais, se for necessária.

Não registre senhas, códigos de autenticação, números completos de cartão, CPF ou extratos identificáveis.

## Critério mínimo para o próximo beta

- [ ] O app abre e navega sem falhas bloqueantes.
- [ ] Contas e movimentações mantêm saldos consistentes após criar, editar e excluir.
- [ ] Metas, orçamento e relatórios batem com os dados de teste.
- [ ] Captura bancária ausente e dados financeiros legados preservados.
- [ ] Persistência após reiniciar e atualização sobre a instalação anterior foram verificadas.

Este documento é um roteiro; os itens não devem ser considerados aprovados até serem testados em dispositivo real.
