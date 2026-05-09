<script setup>
import { ref, onMounted } from 'vue';
import { supabase } from '@/api/supabase';

// 1. Memorias Reactivas
const usuarios = ref([]);
const mostrarModal = ref(false);
const cargando = ref(false); // Para mostrar que está trabajando
const errores = ref({});

const listaRoles = ref([]);
const listaAreas = ref([]);

const nuevoUsuario = ref({
  primerNombre: '', segundoNombre: '',
  primerApellido: '', segundoApellido: '',
  numeroDocumento: '', email: '',
  password: '', rolID: '', areaID: ''
});

// 2. Funciones de Control
const cerrarModal = () => {
  mostrarModal.value = false;
  errores.value = {};
  nuevoUsuario.value = { 
    primerNombre: '', segundoNombre: '', primerApellido: '', 
    segundoApellido: '', numeroDocumento: '', email: '', 
    password: '', rolID: '', areaID: '' 
  };
};

const validarFormulario = () => {
  errores.value = {};
  let esValido = true;
  if (nuevoUsuario.value.numeroDocumento.length < 5) {
    errores.value.numeroDocumento = 'Documento demasiado corto.';
    esValido = false;
  }
  if (nuevoUsuario.value.password.length < 6) {
    errores.value.password = 'Mínimo 6 caracteres.';
    esValido = false;
  }
  return esValido;
};

// 3. LA FUNCIÓN MAESTRA: Guardar en Supabase
const guardarUsuario = async () => {
  if (!validarFormulario()) return;
  
  cargando.value = true;
  try {
    // PASO 1: Crear el usuario en la Autenticación (auth.users)
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: nuevoUsuario.value.email,
      password: nuevoUsuario.value.password,
    });

    if (authError) throw authError;

    const newUserId = authData.user.id;

    // PASO 2: Crear el perfil en tu tabla 'usuarios'
    const { error: perfilError } = await supabase
      .from('usuarios')
      .insert([{
        id: newUserId, // Usamos el mismo ID de auth
        primerNombre: nuevoUsuario.value.primerNombre,
        segundoNombre: nuevoUsuario.value.segundoNombre,
        primerApellido: nuevoUsuario.value.primerApellido,
        segundoApellido: nuevoUsuario.value.segundoApellido,
        numeroDocumento: nuevoUsuario.value.numeroDocumento,
        estado: true
      }]);

    if (perfilError) throw perfilError;

    // PASO 3: Asignar Rol y Área (Tablas relacionales)
    await Promise.all([
      supabase.from('usuarioRol').insert([{ usuarioID: newUserId, rolID: nuevoUsuario.value.rolID }]),
      supabase.from('usuarioArea').insert([{ usuarioID: newUserId, areaID: nuevoUsuario.value.areaID }])
    ]);

    // ÉXITO
    alert('¡Usuario creado con éxito!');
    cerrarModal();
    fetchUsuarios(); // Recargamos la tabla para ver al nuevo usuario

  } catch (error) {
    alert('Error al guardar: ' + error.message);
  } finally {
    cargando.value = false;
  }
};

// 4. Cargar Datos Iniciales
const fetchSelects = async () => {
  const [resRoles, resAreas] = await Promise.all([
    supabase.from('roles').select('id, nombreRol'),
    supabase.from('areas').select('id, nombreArea')
  ]);
  if (!resRoles.error) listaRoles.value = resRoles.data;
  if (!resAreas.error) listaAreas.value = resAreas.data;
};

const fetchUsuarios = async () => {
  const { data, error } = await supabase
    .from('usuarios')
    .select(`
      id, primerNombre, primerApellido, numeroDocumento, estado,
      usuarioRol ( roles ( nombreRol ) ),
      usuarioArea ( areas ( nombreArea ) )
    `);

  if (!error) {
    usuarios.value = data.map(u => ({
      id: u.id,
      nombreCompleto: `${u.primerNombre} ${u.primerApellido}`,
      documento: u.numeroDocumento,
      email: 'Cargando...', // El email vive en auth, luego veremos cómo traerlo
      estado: u.estado ? 'ACTIVO' : 'INACTIVO',
      rol: u.usuarioRol?.[0]?.roles?.nombreRol || 'N/A',
      area: u.usuarioArea?.[0]?.areas?.nombreArea || 'N/A'
    }));
  }
};

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
                <input v-model="nuevoUsuario.numeroDocumento" type="text" required class="form-input" :class="{ 'input-error': errores.numeroDocumento }">
                <span v-if="errores.numeroDocumento" class="error-text">{{ errores.numeroDocumento }}</span>
              </div>
              
              <div class="form-group">
                <label>Correo Electrónico *</label>
                <input v-model="nuevoUsuario.email" type="email" required class="form-input" :class="{ 'input-error': errores.email }">
                <span v-if="errores.email" class="error-text">{{ errores.email }}</span>
              </div>
              
              <div class="form-group">
                <label>Contraseña Temporal *</label>
                <input v-model="nuevoUsuario.password" type="password" required minlength="6" class="form-input" :class="{ 'input-error': errores.password }">
                <span v-if="errores.password" class="error-text">{{ errores.password }}</span>
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

/* --- Clases Dinámicas de Error --- */
.input-error {
  border-color: #EF4444 !important; /* Rojo de error */
  background-color: #FEF2F2;
}

.input-error:focus {
  outline-color: #EF4444 !important;
}

.error-text {
  color: #EF4444;
  font-size: 0.75rem;
  font-weight: 500;
  margin-top: 0.3rem;
  display: block;
}
</style>