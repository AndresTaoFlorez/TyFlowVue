<script setup>
import { useAuthStore } from '@/stores/auth';
import { useRouter } from 'vue-router';

const authStore = useAuthStore();
const router = useRouter();

const handleLogout = async () => {
  await authStore.logout();
  router.push('/'); // Al cerrar sesión, volvemos al inicio
};
</script>

<template>
  <div class="layout">
    <header class="layout__header topbar">
        <div class="topbar__brand">
            <!-- 1. Mostramos el nombre real del usuario desde Pinia -->
            <h2>Bienvenido, {{ authStore.profile?.primerNombre }}</h2>
        </div>
        <div class="topbar__actions">
            <button class="btn-secondary">
                <i class='bx bx-lock-alt'></i> Cambiar Clave
            </button>
        </div>
    </header>

    <!-- ... el resto del sidebar se mantiene igual ... -->

    <aside class="layout__sidebar sidebar">
        <ul class="sidebar__list">
            <li class="sidebar__item">
                <!-- Navegación por nombre al Dashboard -->
                <RouterLink :to="{ name: 'dashboard' }" class="sidebar__link" active-class="sidebar__link--active">
                    <i class='bx bx-home-alt-2 sidebar__icon'></i> 
                    Inicio
                </RouterLink>
            </li>
            <li class="sidebar__item admin-only">
                <!-- Navegación por nombre a Usuarios -->
                <RouterLink :to="{ name: 'users' }" class="sidebar__link" active-class="sidebar__link--active">
                    <i class='bx bx-user sidebar__icon'></i> 
                    Usuarios
                </RouterLink>
            </li>
        </ul>

        <div class="sidebar__footer">
            <!-- 2. Conectamos el botón con nuestra función de logout -->
            <button @click="handleLogout" class="sidebar__link sidebar__link--logout">
                <i class='bx bx-power-off sidebar__icon'></i> Cerrar sesión
            </button>
        </div>
    </aside>

    <main class="layout__main">
        <router-view />
    </main>
  </div>
</template>

<style scoped>
/* Los estilos globales ya están en tu reset.css y layout.css, 
   no necesitamos duplicarlos aquí si ya los importaste en main.js o App.vue */
</style>