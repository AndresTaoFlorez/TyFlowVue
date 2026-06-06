## testing user

```
andrestao577@gmail.com
pepita2026*
```

test user

```
andresjose577@gmail.com
pruebas2026*
```


## Data Base

Supabase Data Base
**TyFlow 2.0**

mejora este prompt e implementalo

[ ] - Fix: En el modal de edición de las work_window Agregar al mismo horario, quitar "Agregar al mismo horario", ya que no se puede agregar un specialista al work_window, pero si se puede crear con propiedades similares, como por ejemplo la hora y que por defecto se seleccione el aplicativo sobre el cual se le dio clic a la work_window, es decir, la context opcions al dar clic derecho debe incluir el boton "Agregar especialista", pero no dentro de la ventana de edicion del analista debido a que esta es unica para cada uno.


[] - Implementar módulo de agrupación work windows para saber realmente como se tendrán en cuenta las cargas de trabajo -- Esto seria otro boton o herramienta junto a las otras herramientas como seleccionar, borrar, etc, en este caso seria seleccionar para agrupar, osea "Agrupar".
-- ideas:
--- Pueden estar asociadas a una relación entre application y specialist.
--- Cada asignación debe evaluar varias columans de otras tablas para detectar la disponibilidad del analista, y revisar si esto es cumple en la tabla de assigment_decision

[ ] - Implementar ruta de "Casos":

[ ] - Contruir ahora si la ruta de dashboard:


[] - Implementar ruta para la administración de (app/configuracion):
-- support_category: para crear las categorias de soporte y asociar esas categorias a un support level (sin support level no existe category - regla de negocio)
-- support_level: para crear, administrar los niveles de soporte, por ejemplo en production se tienen creados los niveles "basic" y "advanced"
-- role: para crear mas roles. Esto también estará relacionado con los RBAC (Role Based Acces Control) que hay que definir en perfecta sincronización con los RLS.

// segun lo anterior probablemente tendras que modificar estructuralmente algo de la base de datos, para lo cual tienes mi Autorizacion para revisar el archivo (.env) y hacer tomar las key para conectarte a supabase. -- Luego ejecuta las instrucciones del CHANGE_PROTOCOL.md q