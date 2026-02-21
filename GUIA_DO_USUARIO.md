# 📒 Guia Completo do Usuário — Controle de Gastos

> **Versão:** 2.0 · Última atualização: Fevereiro/2026  
> Este guia explica **todas as funcionalidades** do sistema, como cada tela funciona, o que cada campo faz e como os valores são calculados — sem termos técnicos.

---

## Índice

1. [Como entrar no sistema](#1-como-entrar-no-sistema)
2. [Dashboard — Visão Geral](#2-dashboard--visão-geral)
3. [Receitas](#3-receitas)
4. [Salário Mensal Recorrente](#4-salário-mensal-recorrente)
5. [Gastos](#5-gastos)
6. [Parcelas e Cartão de Crédito](#6-parcelas-e-cartão-de-crédito)
7. [Cartões de Crédito](#7-cartões-de-crédito)
8. [Reservas (Caixinhas)](#8-reservas-caixinhas)
9. [Relatórios](#9-relatórios)
10. [Exportar PDF](#10-exportar-pdf)
11. [Notificações](#11-notificações)
12. [Como os valores são calculados](#12-como-os-valores-são-calculados)
13. [Perguntas Frequentes](#13-perguntas-frequentes)

---

## 1. Como entrar no sistema

O sistema usa sua **conta Google** para fazer login. Não é necessário criar uma senha separada.

### Passo a passo
1. Abra o arquivo `index.html` no navegador (ou acesse o link da versão hospedada)
2. Clique no botão **"Entrar"** com o ícone do Google
3. Escolha ou confirme a sua conta Google
4. Pronto — você será redirecionado para o sistema automaticamente

### Segurança
- Todos os dados ficam salvos na sua conta pessoal, na nuvem do Google (Firebase)
- Nenhum outro usuário consegue ver seus dados
- A autenticação usa o padrão OAuth 2.0 (o mesmo que o Google usa para todas as suas ferramentas)
- Os dados ficam criptografados em repouso (proteção AES-256)

### Sair
Clique no botão **"Sair"** no rodapé da barra lateral esquerda.

---

## 2. Dashboard — Visão Geral

O dashboard é a **tela inicial** do sistema. Ele mostra um resumo do mês atual.

### Os 4 cards de resumo

| Card | O que mostra |
|------|-------------|
| **Saldo Atual** | Todo o dinheiro que você tem: receitas registradas + salário recebido + rendimentos das caixinhas calculados até hoje |
| **Gastos do Mês** | Total dos gastos deste mês, incluindo parcelas de cartão com vencimento no mês |
| **Saldo Livre** | Saldo Atual menos os Gastos do Mês — o que sobra após pagar tudo |
| **A Pagar (Cartão)** | Soma das faturas de cartão deste mês que ainda não venceram |

> 💡 **Detalhe importante:** O "Saldo Atual" já inclui os rendimentos que suas caixinhas geraram até hoje, calculados automaticamente a cada dia útil.

### Barra de Orçamento

Mostra visualmente quanto do seu saldo disponível já foi comprometido com gastos:
- **Verde:** menos de 60% utilizado
- **Amarelo:** entre 60% e 80%
- **Vermelho:** acima de 80%

### Vencimentos Próximos

Lista os cartões de crédito com fatura **vencendo nos próximos 7 dias**, mostrando o valor da fatura e quantos dias faltam. Faturas com 2 dias ou menos aparecem marcadas como **urgente** em vermelho.

### Últimas Movimentações

Mostra as 8 transações mais recentes (receitas e gastos juntos), ordenadas da mais nova para a mais antiga.

### Gráficos

- **Receitas vs Gastos (barras):** Compara mês a mês o que entrou e o que saiu no ano atual
- **Categorias de Gastos (pizza):** Mostra em percentual onde foi gasto mais dinheiro no mês atual

### Filtro de mês

No canto superior direito do dashboard há um seletor de mês. Ao trocar, os cards e a barra de orçamento atualizam para mostrar os dados daquele mês.

---

## 3. Receitas

Aqui você registra tudo que **entra** na sua conta: salários extras, freelances, aluguéis recebidos, etc.

> ⚠️ O **salário mensal fixo** tem uma seção própria (veja o item 4). Use as receitas para valores pontuais ou variáveis.

### Como adicionar uma receita

1. Clique em **"Nova Receita"**
2. Preencha os campos:

| Campo | O que é |
|-------|---------|
| **Descrição / Fonte** | De onde veio o dinheiro (ex: "Freelance design") |
| **Valor** | Quanto foi recebido |
| **Data de Recebimento** | Quando o dinheiro entrou |
| **Valor em Reserva?** | Liga/desliga — se o dinheiro foi direto para uma caixinha |
| **Observações** | Anotações livres (opcional) |

### Vincular a uma Caixinha

Se você ativar a opção **"Valor em Reserva?"**, aparece um seletor para escolher qual caixinha recebeu este dinheiro. A partir daí, a receita passa a render conforme a taxa daquela caixinha.

Se a receita já foi salva sem caixinha e você quiser vincular depois:
1. Clique no botão de **editar** (ícone de lápis) na receita
2. A opção **"Transferir para Caixinha"** aparecerá com um seletor das caixinhas disponíveis e a taxa de cada uma
3. Clique em **"Transferir"** para confirmar

### O que é exibido na lista

Cada receita aparece como uma linha mostrando:
- **Data** e **descrição**
- **Valor original** depositado
- **Rendimento acumulado** até hoje (se vinculada a caixinha com taxa)
- **Taxa efetiva** da caixinha vinculada
- Botões de editar e excluir

### Filtro de mês

No topo da lista há um seletor de mês para ver apenas as receitas de um período específico.

---

## 4. Salário Mensal Recorrente

Esta seção é para quem recebe um **valor fixo todo mês** (salário CLT, pró-labore, pensão, etc.).

### Por que existe separado das receitas?

O salário é repetitivo — em vez de você cadastrar manualmente todo mês, você configura uma vez e o sistema registra automaticamente.

### Como configurar

1. Na aba **Receitas**, clique em **"Configurar"** no card de Salário Mensal
2. Preencha:

| Campo | O que é |
|-------|---------|
| **Ativar salário mensal?** | Liga/desliga se deve ser contabilizado |
| **Valor (R$)** | Quanto você recebe por mês |
| **Descrição / Fonte** | Ex: "Salário empresa XYZ" (opcional) |

3. Clique em **Salvar**

### Quando o salário conta nos cálculos?

O sistema contabiliza o salário **apenas a partir do último dia útil de cada mês** (segunda a sexta-feira, excluindo fins de semana). Isso significa:

- Se hoje é dia 20 de fevereiro e o último dia útil de fevereiro ainda não chegou, o salário de fevereiro **não aparece** no saldo ainda
- Quando chegar o último dia útil do mês, o salário **automaticamente passa a aparecer** no saldo

> 💡 Essa lógica existe para não "antecipar" dinheiro que você ainda não recebeu.

### Excluir o salário

Clique no ícone de lixeira que aparece ao lado do botão "Configurar" (só aparece quando há um salário configurado).

---

## 5. Gastos

Aqui você registra tudo que **sai** do seu bolso.

### Como adicionar um gasto

1. Clique em **"Novo Gasto"**
2. Preencha os campos:

| Campo | O que é |
|-------|---------|
| **Descrição** | O que foi comprado (ex: "Supermercado Extra") |
| **Valor** | Valor total da compra |
| **Data** | Quando a compra foi feita |
| **Categoria** | Clique em um dos botões coloridos para categorizar |
| **Forma de Pagamento** | Cartão, Pix ou Dinheiro |
| **Observações** | Notas livres (opcional) |

### Categorias disponíveis

| Ícone | Categoria |
|-------|-----------|
| 🍴 | Alimentação |
| 🚗 | Transporte |
| 🏠 | Moradia |
| ❤️ | Saúde |
| 🎮 | Lazer |
| 🎓 | Educação |
| 👕 | Roupas |
| 💻 | Tecnologia |
| ⋯ | Outro |

### Pagamento a alguém específico (Credor)

Se o gasto foi um pagamento para uma pessoa específica (ex: pagar um amigo de volta, pagar prestador de serviço), ative o toggle **"Pagamento a alguém específico?"** e informe:
- **Nome do credor:** quem vai receber
- **Contato:** telefone ou e-mail (opcional)

O nome do credor aparecerá como uma etiqueta na lista de gastos.

### Filtros

Na lista de gastos você pode filtrar por:
- **Mês:** mostra apenas os gastos de determinado mês
- **Tipo:** Todos / Cartão / Pix / Dinheiro

---

## 6. Parcelas e Cartão de Crédito

Esta é uma das funções mais importantes do sistema. Entender como ela funciona evita confusão nos cálculos.

### Gastos parcelados no cartão

Ao selecionar **Cartão** como forma de pagamento, aparecem campos extras:

| Campo | O que é |
|-------|---------|
| **Cartão** | Qual cartão foi usado (selecionado de uma lista) |
| **Parcelas** | Quantas vezes a compra será dividida |
| **Mês de início das parcelas** | Opcional — veja abaixo |

### Como as parcelas são distribuídas automaticamente

O sistema descobre em qual mês cada parcela vence com base em:
1. O **dia de vencimento** do cartão cadastrado
2. A **data da compra**

**Regra:** Se a compra foi feita **antes** do vencimento do cartão naquele mês, a primeira parcela cai na fatura daquele mesmo mês. Se foi **depois** do vencimento, cai na fatura do mês seguinte.

**Exemplo:** Cartão vence dia 10. Compra feita em 5 de janeiro → 1ª parcela em janeiro. Compra feita em 15 de janeiro → 1ª parcela em fevereiro.

### Campo "Mês de início das parcelas"

Este campo aparece quando você coloca **mais de 1 parcela**. Ele é útil em dois casos:

**Caso 1 — Compra retroativa:** Você comprou algo em fevereiro mas a primeira cobrança no cartão só vai aparecer em março. Coloque "março" aqui.

**Caso 2 — Compra antiga:** Você está cadastrando uma compra parcelada que já tem algumas parcelas pagas. Coloque o mês em que as parcelas começaram para o sistema calcular corretamente.

### Como o sistema trata o mês de início

Quando você define um mês de início **posterior** à data da compra, o sistema aplica uma lógica de **competência orçamentária**:

> A parcela que **vence em março** é contabilizada nos **gastos de fevereiro**.

Isso faz sentido porque é o salário de fevereiro que você vai usar para pagar a fatura de março. Assim, ao ver os gastos de fevereiro, você já enxerga esse compromisso.

### Gerenciador de Parcelas

Para gastos parcelados, aparece um botão de **checklist** na lista de gastos. Ao clicar, abre uma tabela com todas as parcelas mostrando:
- Data de vencimento de cada parcela
- Status: **Paga** (quando a fatura já venceu) ou **Pendente**
- Opção de **pagar antecipadamente** (veja abaixo)

### Pagamento Antecipado de Parcela

Se você quitou uma parcela antes do vencimento:
1. Abra o Gerenciador de Parcelas
2. Clique em **"Pagar"** na parcela desejada
3. Informe a data do pagamento
4. Se houve desconto por antecipação, ative o toggle e informe o valor pago — o sistema calcula automaticamente o desconto obtido

Parcelas pagas antecipadamente aparecem com a etiqueta verde **"Antecipado"**.

---

## 7. Cartões de Crédito

Aqui você cadastra os cartões que usa para fazer compras.

### Para que serve cadastrar cartões?

- Vincular gastos parcelados a um cartão específico
- Ver a **fatura atual** de cada cartão
- Ver quais **lançamentos do mês** cada cartão tem
- Receber alertas de vencimento no dashboard

### Como cadastrar um cartão

1. Clique em **"Novo Cartão"**
2. Preencha os campos:

| Campo | Obrigatório? | O que é |
|-------|-------------|---------|
| **Nome do Cartão** | ✅ Sim | Ex: "Nubank Roxo", "Itaú Visa" |
| **Titular** | Não | Deixe em branco se for seu. Preencha se for de outra pessoa (ex: "Mãe", "Empresa") |
| **Limite (R$)** | Não | O limite total do cartão — se não souber ou não quiser informar, deixe em branco |
| **Dia de Vencimento** | Não | Dia do mês em que a fatura vence — usado para calcular em qual mês cada parcela cai |
| **Cor** | Não | Cor de exibição do cartão na tela |

### Por que o limite e o vencimento são opcionais?

Você pode usar o cartão **apenas para vincular compras** sem precisar gerenciar limite ou vencimento. Isso é útil quando você registra compras feitas no cartão de outra pessoa e quer acompanhar os valores.

### O que cada cartão exibe

Cada cartão aparece como um "cartão virtual" mostrando:
- **Nome** do cartão e **titular** (se informado)
- **Fatura atual** (soma de todos os gastos daquele cartão no mês corrente)
- **Dias para o vencimento** (se o dia de vencimento foi informado)
- **Valor disponível** (limite menos fatura, se o limite foi informado)
- **Barra de uso** do limite (verde, amarelo ou vermelho conforme o percentual)
- **Lista de lançamentos** do mês atual

---

## 8. Reservas (Caixinhas)

As reservas são como **potes digitais** onde você separa dinheiro com um objetivo. Podem ter uma taxa de rendimento diário (como uma poupança ou CDB).

### Como criar uma reserva

1. Clique em **"Nova Reserva"**
2. Preencha os campos:

| Campo | O que é |
|-------|---------|
| **Nome** | Ex: "Viagem para Europa", "Reserva de Emergência" |
| **Meta (R$)** | Valor alvo que você quer guardar nesta reserva (opcional) |
| **Rendimento Diário (%)** | Taxa de rendimento por dia útil — ex: 0.050 para 0,05% ao dia |
| **Ícone** | Escolha um ícone para identificar a reserva visualmente |
| **Cor** | Cor do card da reserva |

### Como o rendimento é calculado?

O rendimento usa **juros compostos** contando apenas **dias úteis** (segunda a sexta-feira, sem fins de semana).

A fórmula é:
```
Saldo = Valor Depositado × (1 + taxa%) ^ número_de_dias_úteis
```

**Exemplo prático:**
- Você depositou R$ 1.000 em 01/01/2026
- Taxa: 0,050% ao dia útil
- Hoje é 01/02/2026 (aproximadamente 23 dias úteis)
- Rendimento ≈ R$ 1.000 × (1,0005)²³ ≈ R$ 11,53 de rendimento
- Saldo atual ≈ R$ 1.011,53

O cálculo é **automático e em tempo real** — toda vez que você abre o sistema, o saldo está atualizado.

### Depositar na reserva

Você não deposita dinheiro diretamente na reserva. Em vez disso, você **registra uma receita** e a vincula à reserva. Assim, o sistema sabe quanto dinheiro entrou naquele pote e começa a calcular o rendimento a partir da data de recebimento.

### O que cada card de reserva mostra

- **Nome** e ícone da reserva
- **Saldo atual** (com rendimentos já calculados até hoje)
- **Total depositado** (sem rendimentos)
- **Total de rendimentos** acumulados
- **Progresso da meta** (barra de porcentagem, se a meta foi configurada)
- **Taxa de rendimento** diária

---

## 9. Relatórios

A seção de relatórios oferece uma visão completa do seu ano financeiro.

### Panorama Anual

Uma tabela com os 12 meses do ano selecionado mostrando:

| Coluna | O que é |
|--------|---------|
| **Mês** | Janeiro a Dezembro. Meses futuros aparecem levemente transparentes com a etiqueta "previsto" |
| **Receitas** | Todas as entradas pontuais (não inclui salário separado) |
| **Gastos** | Total de gastos do mês (com a lógica de competência aplicada) |
| **Saldo do Mês** | Receitas + Salário − Gastos |
| **Acumulado** | Saldo do mês somado a todos os meses anteriores |

Acima da tabela, 4 cards mostram o resumo do ano:
- **Receitas totais** (inclui salário)
- **Gastos totais**
- **Saldo do ano** (verde se positivo, vermelho se negativo)
- **Taxa de poupança** (porcentagem do que sobrou em relação ao que entrou)

### Gráfico de Evolução do Saldo

Linha mostrando como o seu saldo evoluiu nos últimos 6 meses.

### Maiores Gastos por Categoria

Gráfico de barras horizontais com as categorias onde você mais gastou no ano.

### Distribuição por Forma de Pagamento

Gráfico de pizza mostrando quanto foi gasto em Cartão, Pix e Dinheiro.

### Trocar o ano

No canto superior direito do Panorama Anual há um seletor de ano. Você pode analisar qualquer ano passado.

---

## 10. Exportar PDF

O botão **"Exportar PDF"** gera um relatório completo para impressão ou arquivamento. O PDF contém **8 seções**:

### Seção 1 — Cards de resumo do ano
Quatro cartões coloridos com:
- 🟢 **Total Recebido** — com detalhe de quanto foi salário
- 🔴 **Total Gasto** — com contagem de lançamentos
- 🔵 **Saldo do Ano** — com indicação se foi positivo ou negativo
- 🟡 **Taxa de Poupança** — com avaliação (Excelente / Boa / Regular / Negativa)

### Seção 2 — Extrato Mensal
Tabela com os 12 meses separando **Outras Receitas**, **Salário**, **Gastos**, **Saldo do Mês** e **Acumulado**.

### Seção 3 — Gastos por Categoria
Tabela com todas as categorias, valor total e barra visual de participação percentual.

### Seção 4 — Salário Recebido
(Aparece apenas se o salário estiver configurado e ativo.) Mês a mês, mostra quando o salário foi contabilizado e o valor total do ano.

### Seção 5 — Caixinhas / Reservas
Para cada reserva:
- Taxa de rendimento
- Total depositado
- **Rendimento gerado especificamente naquele ano**
- Rendimento total acumulado desde o início
- Saldo atual (ou projetado, no caso de anos futuros)

### Seção 6 — Cartões de Crédito
Lista todos os cartões com titular, vencimento, limite e total faturado no ano.

### Seção 7 — Receitas do ano
Cada receita com data, descrição, destino (caixinha ou conta corrente), valor e rendimento gerado.

### Seção 8 — Todos os Gastos do ano
Cada gasto com data, descrição, categoria, forma de pagamento, informação de parcelas e valor total.

> 💡 O PDF é formatado para **folha A4** com margens adequadas para impressão. Ao clicar no botão, o navegador abrirá uma janela de pré-visualização de impressão automaticamente. Para salvar como PDF, escolha "Salvar como PDF" na impressora.

---

## 11. Notificações

O sino no canto superior direito da tela acende com um ponto vermelho quando há alertas importantes. Clique nele para ver o painel de notificações.

### Tipos de notificações
- **Cartões a vencer em breve** — quando uma fatura está próxima do vencimento
- **Saldo negativo** — quando os gastos do mês superam as receitas
- Outros alertas relevantes baseados nos seus dados

---

## 12. Como os valores são calculados

Esta seção explica a lógica por trás dos números, sem usar termos muito técnicos.

### Saldo do Dashboard

```
Saldo = (todas as receitas + rendimentos gerados até hoje) + salário de meses já vencidos
```

O salário de um mês **só entra no cálculo** quando chega o último dia útil daquele mês.

### Gastos do mês (lógica de competência)

O sistema usa o conceito de **"quando você usa o dinheiro"**, não **"quando a fatura é cobrada"**:

- **Pix / Dinheiro sem parcelas:** conta no mês em que a compra foi feita
- **Cartão sem mês de início definido:** a parcela conta no mês em que a fatura vence
- **Cartão ou parcelado com mês de início definido:** se as parcelas começam no mês seguinte à compra, cada parcela conta **um mês antes** do vencimento

**Exemplo do comportamento:**
> Você comprou uma passagem de avião em fevereiro. Configurou que as parcelas começam em março. A parcela de março conta nos **gastos de fevereiro**, a de abril conta nos gastos de março, e assim por diante.
>
> Isso é correto porque você vai pagar a fatura de março com o salário de fevereiro.

### Rendimento de Caixinhas

```
Valor Atual = Valor Depositado × (1 + taxa_diária)^(dias_úteis_desde_o_depósito)
Rendimento = Valor Atual - Valor Depositado
```

- Apenas **dias úteis** contam (sem fins de semana)
- O cálculo usa **juros compostos** (o rendimento do dia anterior gera rendimento também)
- O cálculo é feito do zero a cada vez que você abre o sistema

### Taxa de Poupança

```
Taxa = (Total Recebido - Total Gasto) ÷ Total Recebido × 100
```

- Acima de 20%: 🏆 Excelente
- Entre 10% e 20%: 👍 Boa
- Entre 0% e 10%: 📈 Regular
- Negativa: 📉 Gastou mais do que recebeu

---

## 13. Perguntas Frequentes

**Por que meu saldo não aumentou com o salário ainda?**  
O salário é contabilizado apenas a partir do **último dia útil do mês**. Se você está no meio do mês, o valor ainda não aparece. Isso é intencional para não antecipar dinheiro que ainda não chegou.

---

**Posso cadastrar um cartão de outra pessoa?**  
Sim. Ao cadastrar um cartão, o campo **"Titular"** é opcional. Preencha com o nome da pessoa (ex: "Mãe", "João"). O dia de vencimento e o limite também são opcionais — você pode cadastrar um cartão só para vincular compras a ele.

---

**Como faço para registrar uma compra parcelada que já aconteceu há meses?**  
Cadastre normalmente o gasto e use o campo **"Mês de início das parcelas"** para indicar quando a primeira parcela foi cobrada. O sistema distribuirá as parcelas a partir daquele mês.

---

**O rendimento das caixinhas é calculado com fins de semana?**  
Não. O sistema conta apenas **dias úteis** (segunda a sexta), pois a maioria dos investimentos de renda fixa no Brasil (CDB, poupança, LCI, etc.) só rende em dias úteis.

---

**Posso ter mais de uma caixinha?**  
Sim, você pode criar quantas reservas quiser, cada uma com sua própria taxa de rendimento e meta.

---

**Como funciona "pagar antecipado" uma parcela?**  
Abre o Gerenciador de Parcelas de um gasto e clique em **"Pagar"** na parcela desejada. Você informa a data e, se houve desconto por antecipação, o valor real pago. A parcela passa a aparecer como "Antecipado" em verde. Isso não altera a parcela no sistema permanentemente — funciona como uma marcação manual.

---

**Por que o PDF gera dois "rendimentos" para as caixinhas?**  
O relatório mostra duas informações diferentes:
- **"Rendeu em [ano]":** quanto a caixinha gerou especificamente dentro daquele ano
- **"Rendimento Total":** total acumulado desde o início do depósito

Isso é útil para comparar a performance de cada caixinha ano a ano.

---

**Posso excluir uma receita que está vinculada a uma caixinha?**  
Sim. Ao excluir a receita, ela sai do cálculo de rendimento daquela caixinha. O saldo da caixinha é sempre recalculado com base nas receitas vinculadas existentes.

---

**Os dados ficam salvos se eu fechar o navegador?**  
Sim. Todos os dados são salvos automaticamente na nuvem do Firebase assim que você clica em "Salvar". Você pode acessar de qualquer dispositivo com sua conta Google.

---

*Guia escrito para uso interno. Sistema desenvolvido com Firebase (Google), JavaScript puro e Chart.js.*
