// ============================================================
//  AUTH MODULE — FinanceHub
// ============================================================

import { auth, provider } from "./firebase-config.js";
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Expor funções globalmente para o app.js
window.FinanceAuth = {

  // Login com Google
  async loginGoogle() {
    try {
      const result = await signInWithPopup(auth, provider);
      return result.user;
    } catch (err) {
      console.error("Erro no login:", err);
      if (err.code !== "auth/popup-closed-by-user") {
        window.showToast("Erro ao fazer login: " + err.message, "error");
      }
      return null;
    }
  },

  // Logout
  async logout() {
    await signOut(auth);
  },

  // Observer de estado de autenticação
  onAuthChange(callback) {
    onAuthStateChanged(auth, callback);
  },

  getCurrentUser() {
    return auth.currentUser;
  }
};
