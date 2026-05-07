<script setup>
import { ref, onMounted } from 'vue';
import { supabase } from '@/api/supabase'; // 🔌 Nuestro cable a Supabase

// 1. Memoria reactiva. Ahora inicia como un arreglo vacío.
const usuarios = ref([]);

// 2. Función asíncrona para ir a buscar la información
const fetchUsuarios = async () => {
  try {
    // 1. Hacemos una consulta relacional (JOIN) al estilo Supabase
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

    console.log('Datos crudos de la BD:', data);

    // 2. Transformamos (mapeamos) los datos para que la tabla de Vue los entienda
    const usuariosFormateados = data.map(u => {
      // Extraemos el rol y el área de forma segura (por si algún usuario no tiene)
      const nombreRol = u.usuarioRol?.[0]?.roles?.nombreRol || 'Sin rol';
      const nombreArea = u.usuarioArea?.[0]?.areas?.nombreArea || 'Sin área';

      return {
        id: u.id,
        nombreCompleto: `${u.primerNombre} ${u.primerApellido}`,
        documento: u.numeroDocumento,
        email: 'correo@oculto.com', // Por seguridad, temporalmente lo dejamos así
        estado: u.estado === true ? 'ACTIVO' : 'INACTIVO',
        rol: nombreRol,
        area: nombreArea
      };
    });

    // 3. Le pasamos los datos formateados a nuestra variable reactiva
    usuarios.value = usuariosFormateados; 

  } catch (error) {
    console.error('Error al cargar los usuarios:', error.message);
  }
};

// 4. Ejecutamos la función apenas la pantalla de Usuarios aparece
onMounted(() => {
  fetchUsuarios();
});
</script>

<template>
  <section class="content">
    
    <!-- Cabecera -->
    <div class="page-header">
        <h1 class="page-header__title">Registro de Usuarios</h1>
        <button class="btn-primary">
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
</style>