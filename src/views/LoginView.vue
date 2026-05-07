<script setup>
import { ref } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useRouter } from 'vue-router'; // 👈 Importamos el GPS desde la librería oficial

const router = useRouter();

// 1. Diccionario local de la vista
const ERROR_MESSAGES = {
  "Invalid login credentials": "El correo o la contraseña son incorrectos.",
  "Email not confirmed": "Debes confirmar tu correo electrónico antes de entrar.",
  "User not found": "No existe un usuario con ese correo.",
  "Password is too short": "La contraseña debe tener al menos 6 caracteres.",
  "Network error": "Hubo un problema de conexión. Revisa tu internet.",
  "Usuario inactivo": "Tu cuenta está inactiva. Contacta al soporte."
};

const email = ref('');
const password = ref('');
const authStore = useAuthStore();
const errorMessage = ref('');

const handleSubmit = async () => {
  errorMessage.value = ''; // Limpiamos antes de empezar
  console.log('Iniciando sesión con:', email.value);

  try {
    // Llamamos al store (que ahora solo lanza el error crudo de Supabase)
    await authStore.login(email.value, password.value);
    
    console.log('¡Bienvenido! Navegando al Dashboard...');
    router.push({ name: 'dashboard' })

  } catch (error) {
    // 🛠️ MAPEAMOS EL ERROR AQUÍ:
    // Buscamos el mensaje original en nuestro diccionario.
    // Si no está, mostramos un mensaje amigable genérico.
    const translatedMessage = ERROR_MESSAGES[error.message] || 'Ocurrió un error inesperado. Inténtalo de nuevo.';
    
    errorMessage.value = translatedMessage;
    
    console.error('Error detectado:', error.message);
  }
};
</script>

<template>
  <main class="login-page">
    <div class="login-card">
      
      <div class="login-card__banner">
        <h3>TYFLOW</h3>
        <p>Gestiona y optimiza tu reparto de manera eficiente.</p>
      </div>

      <div class="login-card__form">
        <h1>Autenticación</h1>
        <form @submit.prevent="handleSubmit" id="loginForm">
          <label for="email">Usuario</label>
          <input 
            v-model="email" 
            type="email" 
            id="email" 
            placeholder="correo@ejemplo.com" 
            required
          >

          <label for="password">Contraseña</label>
          <input 
            v-model="password" 
            type="password" 
            id="password" 
            placeholder="••••••••" 
            required
          >
          
          <p v-if="errorMessage" id="msg" class="errorMessage">{{errorMessage}}</p>
          <button type="submit" class="btn-submit">Iniciar Sesión</button>
        </form>
      </div>

    </div>
  </main>
</template>

<style scoped>

.errorMessage {
  color: var(--error-500);
  margin-top: 1rem;
  text-align: center;
  font-weight: bold;
}
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--bg-main);
  padding: 1rem; /* Margen para que no toque los bordes en móvil */
}

.login-card {
  display: grid;
  grid-template-columns: 1fr 1fr;
  width: 100%;
  max-width: 900px;
  background-color: var(--bg-card);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: var(--shadow-lg);
}

.login-card__form {
  display: flex;
  flex-direction: column;
  padding: 3rem;
  justify-content: center;
}

.login-card__form h1 {
  text-align: center;
  color: var(--primary-500);
  margin-bottom: 1.5rem;
  font-size: 1.8rem;
}

.login-card__form label {
  margin-top: 1rem;
  margin-bottom: 0.5rem;
  font-weight: 600;
  color: var(--text-main);
}

.login-card__form input {
  width: 100%;
  padding: 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 1rem;
}

.btn-submit {
  padding: 15px;
  margin-top: 2rem;
  background-color: var(--primary-500);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: bold;
  font-size: 1rem;
  transition: background 0.3s;
}

.login-card__banner {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background: var(--primary-gradient);
  padding: 60px;
  color: white;
  text-align: center;
}

.login-card__banner h3 {
  font-size: 2.5rem;
  margin-bottom: 1rem;
}

/* =========================================
   ADAPTACIÓN PARA CELULARES (Mobile)
   ========================================= */
@media (max-width: 768px) {
  .login-page {
    padding: 0; /* En móvil aprovechamos todo el espacio */
    align-items: flex-start; /* Permite scroll si el teclado aparece */
  }

  .login-card {
    grid-template-columns: 1fr; /* Una sola columna */
    border-radius: 0; /* Estilo full-screen */
    min-height: 100vh;
    box-shadow: none;
  }

  .login-card__banner {
    padding: 40px 20px;
    order: 1; /* El banner va arriba */
  }

  .login-card__banner h3 {
    font-size: 2rem;
  }

  .login-card__banner p {
    font-size: 0.9rem;
  }

  .login-card__form {
    padding: 2rem;
    order: 2; /* El formulario va abajo */
  }

  .login-card__form h1 {
    font-size: 1.5rem;
  }

  /* Mejora táctil para inputs y botones */
  .login-card__form input {
    padding: 14px; 
    font-size: 16px; /* Evita que iOS haga zoom automático al enfocar */
  }

  .btn-submit {
    margin-top: 1.5rem;
    padding: 18px;
  }

  .login-card__form button, 
  .btn-submit {
    width: 100%;        /* Ocupa todo el ancho del formulario */
    display: block;     /* Se asegura de comportarse como un bloque */
    margin-top: 1.5rem; 
    padding: 16px;      /* Un poco más de área de toque */
    font-size: 1.1rem;  /* Fuente ligeramente más grande para legibilidad */
    border-radius: 8px; /* Coherente con los inputs */
  }

  /* Asegúrate de que el formulario no tenga un alineado a la izquierda forzado */
  #loginForm {
    display: flex;
    flex-direction: column;
    width: 100%;
  }
}
</style>