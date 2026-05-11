<script setup>
import { useAuthStore } from '@/presentation/stores/useAuthStore'

const authStore = useAuthStore()
const profile = authStore.profile
</script>

<template>
  <section class="content">
    <div class="page-header">
      <h1 class="page-header__title">Mi Perfil</h1>
    </div>

    <div class="profile-card" v-if="profile">
      <div class="profile-card__header">
        <div class="profile-card__avatar">
          <i class='bx bx-user'></i>
        </div>
        <div class="profile-card__identity">
          <h2>{{ profile.fullName }}</h2>
          <span class="profile-card__email">{{ profile.email || '—' }}</span>
        </div>
        <span v-if="profile.isActive" class="status-badge status-badge--active">Activo</span>
        <span v-else class="status-badge status-badge--inactive">Inactivo</span>
      </div>

      <div class="profile-card__body">
        <div class="profile-field">
          <span class="profile-field__label">Documento</span>
          <span class="profile-field__value">{{ profile.documentNumber }}</span>
        </div>
        <div class="profile-field">
          <span class="profile-field__label">Nombre completo</span>
          <span class="profile-field__value">
            {{ profile.firstName }}
            {{ profile.secondName ? profile.secondName + ' ' : '' }}
            {{ profile.firstSurname }}
            {{ profile.secondSurname || '' }}
          </span>
        </div>
        <div class="profile-field">
          <span class="profile-field__label">Roles</span>
          <div class="profile-field__tags">
            <template v-if="profile.roleName">
              <span v-for="rol in profile.roleName.split(', ')" :key="rol" class="role-tag">{{ rol }}</span>
            </template>
            <span v-else class="profile-field__na">Sin rol asignado</span>
          </div>
        </div>
        <div class="profile-field">
          <span class="profile-field__label">Areas</span>
          <div class="profile-field__tags">
            <template v-if="profile.areaName">
              <span v-for="area in profile.areaName.split(', ')" :key="area" class="area-tag">{{ area }}</span>
            </template>
            <span v-else class="profile-field__na">Sin área asignada</span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.page-header__title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
}

.profile-card {
  background: white;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

.profile-card__header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.5rem;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border-light);
}

.profile-card__avatar {
  width: 3.5rem;
  height: 3.5rem;
  border-radius: var(--radius-full);
  background: var(--primary-500);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.75rem;
  flex-shrink: 0;
}

.profile-card__identity {
  flex: 1;
  min-width: 0;
}

.profile-card__identity h2 {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.profile-card__email {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.profile-card__body {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.profile-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.profile-field__label {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-secondary);
  letter-spacing: 0.05em;
}

.profile-field__value {
  font-size: 1rem;
  color: var(--text-primary);
}

.profile-field__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.profile-field__na {
  color: var(--text-secondary);
  font-size: 0.85rem;
}

.status-badge {
  padding: 0.3rem 0.8rem;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
}

.status-badge--active {
  background-color: var(--success-bg);
  color: var(--success-text);
}

.status-badge--inactive {
  background-color: var(--error-bg);
  color: var(--error-text);
}

.role-tag, .area-tag {
  display: inline-block;
  padding: 0.3rem 0.6rem;
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  font-weight: 600;
}

.role-tag { background: #E0E7FF; color: #3730A3; }
.area-tag { background: #DBEAFE; color: #1E40AF; }

@media (max-width: 768px) {
  .profile-card__header {
    flex-wrap: wrap;
  }
  .page-header__title {
    font-size: 1.2rem;
  }
}
</style>
