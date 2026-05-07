<script setup>
import { ref, onMounted } from 'vue';
import { supabase } from '@/api/supabase';

// 1. Memorias Reactivas Principales
const usuarios = ref([]);
const mostrarModal = ref(false);

// 2. Memorias para los selectores (listas desplegables)
const listaRoles = ref([]);
const listaAreas = ref([]);

// 3. Memoria para el nuevo usuario (con todos los campos de BD)
const nuevoUsuario = ref({
  primerNombre: '',
  segundoNombre: '',
  primerApellido: '',
  segundoApellido: '',
  numeroDocumento: '',
  email: '',
  rolID: '',
  areaID: ''
});

// 4. Función para cerrar y limpiar el formulario
const cerrarModal = () => {
  mostrarModal.value = false;
  nuevoUsuario.value = {
    primerNombre: '', segundoNombre: '', primerApellido: '', 
    segundoApellido: '', numeroDocumento: '', email: '', 
    rolID: '', areaID: '' 
  };
};

// 5. Función para traer Roles y Áreas (Los catálogos)
const fetchSelects = async () => {
  try {
    const [resRoles, resAreas] = await Promise.all([
      supabase.from('roles').select('id, nombreRol'),
      supabase.from('areas').select('id, nombreArea')
    ]);

    if (!resRoles.error) listaRoles.value = resRoles.data;
    if (!resAreas.error) listaAreas.value = resAreas.data;
  } catch (error) {
    console.error("Error cargando listas:", error);
  }
};

// 6. Función para traer la lista de usuarios para la tabla
const fetchUsuarios = async () => {
  try {
    const { data, error } = await supabase
      .from('usuarios')
      .select(`
        id,
        primerNombre,
        primerApellido,
        numeroDocumento,
        estado,
        usuarioRol ( roles ( nombreRol ) ),
        usuarioArea ( areas ( nombreArea ) )
      `);

    if (error) throw error;

    const usuariosFormateados = data.map(u => {
      const nombreRol = u.usuarioRol?.[0]?.roles?.nombreRol || 'Sin rol';
      const nombreArea = u.usuarioArea?.[0]?.areas?.nombreArea || 'Sin área';

      return {
        id: u.id,
        nombreCompleto: `${u.primerNombre} ${u.primerApellido}`,
        documento: u.numeroDocumento,
        email: 'correo@oculto.com', 
        estado: u.estado === true ? 'ACTIVO' : 'INACTIVO',
        rol: nombreRol,
        area: nombreArea
      };
    });

    usuarios.value = usuariosFormateados; 
  } catch (error) {
    console.error('Error al cargar los usuarios:', error.message);
  }
};

// 7. Evento que dispara las descargas al cargar la página
onMounted(() => {
  fetchUsuarios();
  fetchSelects();
});
</script>
<template>
  <section class="content">
    
    <!-- Cabecera -->
    <div class="page-header">
        <h1 class="page-header__title">Registro de Usuarios</h1>
        <button @click="mostrarModal = true" class="btn-primary">
            <i class='bx bx-plus'></i> Crear nuevo usuario
        </button>
    </div>

    <!-- Buscador -->
    <div class="filter-bar">
        <div class="filter-bar__group">
            <i class='bx bx-search filter-bar__icon'></i>
            <input type="text" class="filter-bar__input" placeholder="Buscar por nombre...">
        </div>
        <div class="filter-bar__group">
            <i class='bx bx-envelope filter-bar__icon'></i>
            <input type="text" class="filter-bar__input" placeholder="Buscar por correo...">
        </div>
    </div>

    <!-- Tabla -->
    <div class="table-container">
        <table class="datatable">
            <thead>
                <tr class="datatable__header">
                    <th>Estado</th>
                    <th>Nombre Completo</th>
                    <th>Documento</th>
                    <th>Correo</th>
                    <th>Rol</th>
                    <th>Área</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody>
                <!-- 2. LA MAGIA DE VUE: v-for -->
                <!-- Vue iterará sobre el arreglo 'usuarios' y pintará un <tr> por cada uno -->
                <tr v-for="user in usuarios" :key="user.id" class="datatable__row">
                    
                    <td>
                        <!-- v-if y v-else nos permiten condicionar qué HTML mostrar -->
                        <span v-if="user.estado === 'ACTIVO'" class="status-badge status-badge--active">Activo</span>
                        <span v-else class="status-badge status-badge--inactive">Inactivo</span>
                    </td>
                    
                    <td class="datatable__cell--bold">{{ user.nombreCompleto }}</td>
                    <td>{{ user.documento }}</td>
                    <td>{{ user.email }}</td>
                    <td><span class="role-tag">{{ user.rol }}</span></td>
                    <td>{{ user.area }}</td>
                    
                    <td>
                        <button class="btn-icon-small">
                            <i class='bx bx-edit-alt'></i>
                        </button>
                    </td>
                    
                </tr>
            </tbody>
        </table>
    </div>


    <div v-if="mostrarModal" class="modal-overlay">
      <div class="modal-content">
        <div class="modal-header">
          <h2>Registrar Nuevo Usuario</h2>
          <button @click="cerrarModal" class="btn-close"><i class='bx bx-x'></i></button>
        </div>
        
        <form @submit.prevent="guardarUsuario" class="modal-form">
          <div class="form-grid">
              <div class="form-group">
                <label>Primer Nombre *</label>
                <input v-model="nuevoUsuario.primerNombre" type="text" required class="form-input">
              </div>
              <div class="form-group">
                <label>Segundo Nombre</label>
                <input v-model="nuevoUsuario.segundoNombre" type="text" class="form-input">
              </div>
              <div class="form-group">
                <label>Primer Apellido *</label>
                <input v-model="nuevoUsuario.primerApellido" type="text" required class="form-input">
              </div>
              <div class="form-group">
                <label>Segundo Apellido</label>
                <input v-model="nuevoUsuario.segundoApellido" type="text" class="form-input">
              </div>
              <div class="form-group">
                <label>Número de Documento *</label>
                <input v-model="nuevoUsuario.numeroDocumento" type="text" required class="form-input">
              </div>
              <div class="form-group">
                <label>Correo Electrónico *</label>
                <input v-model="nuevoUsuario.email" type="email" required class="form-input">
              </div>
              
              <div class="form-group">
                <label>Rol Asignado *</label>
                <select v-model="nuevoUsuario.rolID" required class="form-input">
                  <option value="" disabled>Seleccione un rol...</option>
                  <option v-for="rol in listaRoles" :key="rol.id" :value="rol.id">
                    {{ rol.nombreRol }}
                  </option>
                </select>
              </div>
              <div class="form-group">
                <label>Área Asignada *</label>
                <select v-model="nuevoUsuario.areaID" required class="form-input">
                  <option value="" disabled>Seleccione un área...</option>
                  <option v-for="area in listaAreas" :key="area.id" :value="area.id">
                    {{ area.nombreArea }}
                  </option>
                </select>
              </div>
          </div>
          
          <div class="modal-actions">
            <button type="button" @click="cerrarModal" class="btn-secondary">Cancelar</button>
            <button type="submit" class="btn-primary">Guardar Usuario</button>
          </div>
        </form>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* Contenedor principal */
.content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* Cabecera y Título */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.page-header__title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
}

/* Botón Principal (El que no se veía) */
.btn-primary {
  background-color: var(--primary-500);
  color: white;
  padding: 0.6rem 1.2rem;
  border-radius: 8px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: background-color 0.2s ease;
}

.btn-primary:hover {
  background-color: var(--primary-600);
}

/* Barra de Búsqueda / Filtros */
.filter-bar {
  display: flex;
  gap: 1rem;
  background: white;
  padding: 1rem;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}

.filter-bar__group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border: 1px solid var(--border-light);
  padding: 0.6rem 1rem;
  border-radius: 6px;
  flex: 1;
  background-color: var(--bg-main);
}

.filter-bar__icon {
  color: var(--text-secondary);
  font-size: 1.2rem;
}

.filter-bar__input {
  border: none;
  outline: none;
  width: 100%;
  color: var(--text-primary);
  background: transparent;
}

/* Tabla de Datos */
.table-container {
  background: white;
  border-radius: 8px;
  padding: 1rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  overflow-x: auto;
}

.datatable {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

.datatable th, .datatable td {
  padding: 1rem;
  border-bottom: 1px solid var(--border-light);
}

.datatable__header {
  color: var(--text-secondary);
  font-weight: 600;
  background-color: var(--bg-card);
}

.datatable__row:hover {
  background-color: #f9fafb;
}

.datatable__cell--bold {
  font-weight: 600;
  color: var(--text-primary);
}

/* Etiquetas de Estado (Badges) */
.status-badge {
  padding: 0.3rem 0.8rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
}

.status-badge--active {
  background-color: #D1FAE5; /* Verde muy claro */
  color: #065F46; /* Verde oscuro */
}

.status-badge--inactive {
  background-color: #FEE2E2; /* Rojo muy claro */
  color: #991B1B; /* Rojo oscuro */
}

/* Etiqueta de Rol */
.role-tag {
  background: #E0E7FF;
  color: #3730A3;
  padding: 0.3rem 0.6rem;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
}

/* Botón de Acciones (Editar) */
.btn-icon-small {
  background: transparent;
  color: var(--text-secondary);
  font-size: 1.25rem;
  padding: 0.3rem;
  border-radius: 4px;
  transition: 0.2s;
}

.btn-icon-small:hover {
  color: var(--primary-500);
  background-color: var(--bg-card);
}

/* --- Estilos del Modal --- */
.modal-overlay {
  position: fixed; top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(0, 0, 0, 0.5); backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
  z-index: 100;
}
.modal-content {
  background: var(--bg-main); width: 100%; max-width: 600px; /* Lo hice un poquito más ancho */
  border-radius: 12px; padding: 2rem;
  box-shadow: var(--shadow-lg);
}
.modal-header {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;
}
.btn-close {
  background: transparent; font-size: 1.5rem; color: var(--text-secondary);
}
.modal-form {
  display: flex; flex-direction: column; gap: 1rem;
}
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}
.form-group label {
  font-size: 0.85rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 0.3rem; display: block;
}
.form-input {
  width: 100%; padding: 0.8rem; border: 1px solid var(--border-light); border-radius: 8px;
}
.form-input:focus {
  outline: none; border-color: var(--primary-500);
}
.modal-actions {
  display: flex; justify-content: flex-end; gap: 1rem; margin-top: 1.5rem;
}
</style>