// ============================================================
//  FIREBASE CONFIG — FinanceHub
//  Substitua os valores abaixo com os dados do seu projeto
//  no Firebase Console: https://console.firebase.google.com
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ⚠️  INSTRUÇÕES DE CONFIGURAÇÃO:
// 1. Acesse https://console.firebase.google.com
// 2. Crie um novo projeto (ou use um existente)
// 3. Adicione um app Web (ícone </>)
// 4. Ative o Google como provedor em Authentication → Sign-in method
// 5. Ative o Firestore Database em modo de produção
// 6. Vá em Project Settings → General → Seus apps → Configuração do SDK
// 7. Cole os valores abaixo substituindo os campos:

const firebaseConfig = {
  apiKey:            "AIzaSyA_L0GC2xzxEFs_pn4LJqgOneR5KEqwhS4",
  authDomain:        "inancehub-meu.firebaseapp.com",
  projectId:         "inancehub-meu",
  storageBucket:     "inancehub-meu.firebasestorage.app",
  messagingSenderId: "10896371244",
  appId:             "1:10896371244:web:fb7de392bd6cf27220ab89"
};

// Inicializar Firebase
const app      = initializeApp(firebaseConfig);
const auth     = getAuth(app);
const db       = getFirestore(app);
const provider = new GoogleAuthProvider();

// Solicitar email no login
provider.addScope("email");
provider.addScope("profile");

export { auth, db, provider };
