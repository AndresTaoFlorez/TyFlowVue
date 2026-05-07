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
/* Por ahora no necesitamos estilos extra porque ya tienes todo en tus estilos globales de assets/main.css */
</style>