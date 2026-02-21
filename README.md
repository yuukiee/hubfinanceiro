# 💰 FinanceHub — Controle Financeiro Pessoal

Sistema completo de controle financeiro pessoal com login Google e armazenamento na nuvem via Firebase.

---

## 🚀 Como Configurar (Passo a Passo)

### 1. Criar Projeto no Firebase

1. Acesse [https://console.firebase.google.com](https://console.firebase.google.com)
2. Clique em **"Adicionar projeto"**
3. Dê um nome (ex: `financehub-meu`)
4. Desative o Google Analytics (opcional)
5. Clique em **"Criar projeto"**

### 2. Ativar Autenticação Google

1. No menu lateral, clique em **"Authentication"**
2. Clique em **"Primeiros passos"**
3. Na aba **"Sign-in method"**, clique em **"Google"**
4. Ative o toggle e informe seu e-mail de suporte
5. Salve

### 3. Criar Banco de Dados Firestore

1. No menu lateral, clique em **"Firestore Database"**
2. Clique em **"Criar banco de dados"**
3. Escolha **"Começar no modo de produção"**
4. Selecione uma região (ex: `southamerica-east1`)
5. Clique em **"Ativar"**

### 4. Configurar Regras de Segurança do Firestore

No Firestore, vá em **"Regras"** e cole o seguinte:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### 5. Obter Credenciais do App Web

1. No menu lateral, clique em ⚙️ **"Configurações do projeto"**
2. Desça até **"Seus apps"** e clique no ícone `</>`  (Web)
3. Dê um apelido ao app e clique em **"Registrar app"**
4. Copie o objeto `firebaseConfig` que aparece

### 6. Inserir Credenciais no Projeto

Abra o arquivo `firebase-config.js` e substitua os valores:

```javascript
const firebaseConfig = {
  apiKey:            "SUA_API_KEY",
  authDomain:        "SEU_PROJECT.firebaseapp.com",
  projectId:         "SEU_PROJECT_ID",
  storageBucket:     "SEU_PROJECT.appspot.com",
  messagingSenderId: "SEU_SENDER_ID",
  appId:             "SEU_APP_ID"
};
```

### 7. Adicionar Domínio Autorizado (se hospedar online)

1. Em **Authentication → Settings → Domínios autorizados**
2. Adicione seu domínio

### 8. Rodar o Projeto

Como o projeto usa módulos ES6 (`type="module"`), você precisa de um servidor local:

**Opção A — VS Code (recomendado):**
- Instale a extensão **"Live Server"**
- Clique com botão direito em `index.html` → **"Open with Live Server"**

**Opção B — Python:**
```bash
python -m http.server 8080
# Abra: http://localhost:8080
```

**Opção C — Node.js:**
```bash
npx serve .
```

---

## 📋 Funcionalidades

### 💸 Receitas
- Cadastro com descrição e fonte
- Rendimento diário percentual (composto, apenas dias úteis Seg–Sex)
- Vinculação a uma reserva
- Histórico completo com filtro por mês

### 💳 Gastos
- Cadastro com categoria (Alimentação, Transporte, Moradia, Saúde, Lazer, etc.)
- Forma de pagamento: Cartão, Pix, Dinheiro
- Para cartão: seleção do cartão e número de parcelas
- Pagamento a credor específico (nome + contato)
- Filtro por mês e tipo de pagamento

### 🏦 Cartões de Crédito
- Cadastro com limite, dia de vencimento e cor personalizada
- Visualização estilo cartão físico
- Fatura calculada automaticamente por mês
- Barra de limite utilizado
- Listagem de lançamentos do mês

### 🐷 Reservas
- Criação de reservas com nome, meta, ícone e cor
- Saldo calculado a partir das receitas vinculadas
- Barra de progresso em relação à meta

### 📊 Dashboard
- **Saldo atual** com rendimentos acumulados
- **Gastos do mês** com projeção até o último dia
- **Saldo livre** (saldo − gastos previstos)
- **A pagar no cartão** (faturas do mês)
- Barra de orçamento com alerta visual
- Gráfico de Receitas vs Gastos (mensal, anual)
- Gráfico de categorias de gastos (donut)
- Vencimentos próximos (7 dias)
- Últimas movimentações

### 📈 Relatórios
- Evolução do saldo (últimos 6 meses)
- Maiores gastos por categoria (horizontal bar)
- Distribuição por forma de pagamento (pizza)

### 🔔 Notificações
- Alertas automáticos de vencimento de fatura (5 dias de antecedência)
- Urgência destacada para vencimentos em 2 dias ou menos

---

## 🗂️ Estrutura de Arquivos

```
Sistema_Controle/
├── index.html          # Estrutura HTML completa
├── styles.css          # Design system dark mode
├── firebase-config.js  # ⚠️ Configurar com suas credenciais
├── auth.js             # Módulo de autenticação Google
├── app.js              # Lógica principal da aplicação
└── README.md           # Este arquivo
```

---

## 🔒 Segurança

- Cada usuário só acessa seus próprios dados (regra Firestore por UID)
- Login exclusivo via conta Google
- Dados nunca saem do seu Firebase pessoal

---

## 💡 Tecnologias Utilizadas

| Tecnologia | Uso |
|---|---|
| HTML5 / CSS3 | Interface |
| JavaScript ES6+ | Lógica |
| Firebase Auth | Login Google |
| Cloud Firestore | Banco de dados |
| Chart.js | Gráficos |
| Font Awesome 6 | Ícones |
| Google Fonts (Inter) | Tipografia |
