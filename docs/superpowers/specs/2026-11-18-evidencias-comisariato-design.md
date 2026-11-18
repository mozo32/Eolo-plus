# Evidencias fotográficas en Servicio Comisariato

**Fecha:** 2026-11-18
**Rama de origen:** `entrega-turno-seguridad`

El recibo de comisariato se firma pero no se prueba: no hay forma de dejar
constancia de qué se entregó. Esta versión añade evidencias fotográficas al
servicio —opcionales, sin límite de cuántas— y las imprime en el PDF.

Lo que **no** cambia: los campos del servicio, su validación, la ventana de
fecha `comisariato.entrega`, el borrado lógico, la vista previa (que enseña el
mismo documento que el PDF) y el diseño visual de la pantalla.

---

## 1. Dónde se guardan

**No se crea ninguna tabla.** El proyecto ya tiene el par polimórfico
`imagens` + `imageables`, con la misma forma que `firmas` + `firmables`:

| Tabla | Lo que guarda |
|---|---|
| `imagens` | `disk`, `path`, `original_name`, `mime`, `size`, `status` |
| `imageables` | `imagen_id`, `imageable_type`, `imageable_id`, `tag`, `orden`, `status` |

`ServicioComisariato` gana una relación nueva:

```php
public function evidencias(): MorphToMany
{
    return $this->morphToMany(Imagen::class, 'imageable', 'imageables')
        ->withPivot(['tag', 'orden', 'status'])
        ->wherePivot('status', 'A')
        ->withTimestamps();
}
```

El `wherePivot('status', 'A')` es el mismo filtro que usa `firmas()` en
`EntregaTurnoSeguridad`: borrar una evidencia pone el pivote en `N` y deja de
verse, sin destruir el archivo ni el renglón. En un documento que sirve de
prueba, destruir no es una opción razonable.

`Imagen` ya expone `getUrlAttribute()`, así que no hace falta tocar el modelo.
Su relación `walkarounds()` se queda como está; no se añade la inversa
`serviciosComisariato()` porque nadie navega en esa dirección — de la imagen al
servicio— y una relación que nadie usa es peso muerto.

Los archivos van al disco `public`, en
`evidencias/ServicioComisariato/AAAA/MM/`, con nombre uuid y extensión sacada
de una lista cerrada (`jpg`, `png`, `webp`) y no de partir el mime, por lo
mismo que en `EntregaTurnoSeguridadController`: partir el mime dejaba un SVG
como `.svg+xml`.

## 2. La captura

### El obstáculo, medido

`navigator.mediaDevices.getUserMedia` solo existe en **contexto seguro**:
HTTPS o `localhost`. El equipo entra a Eolo por `http://192.168.7.10:8000`, y
ahí no lo hay. Medido en ese servidor el 2026-11-18:

```
origen:                 http://192.168.7.10:8000
window.isSecureContext: false
navigator.mediaDevices: undefined
getUserMedia:           false
```

El navegador ni siquiera expone el objeto. No es un permiso que el usuario
pueda conceder ni algo que se programe alrededor.

### La solución, que el proyecto ya tiene

`resources/js/pages/Trafico/prestamoChalecos/FotoIne.tsx` resolvió esto bien:
intenta `getUserMedia` y, cuando no lo hay, cae a un `<input type="file">`.
Por eso Préstamo de chalecos funciona en producción y Walk Around y
Movimientos de vehículos no.

El componente nuevo sigue ese patrón, con una mejora: el campo de archivo
lleva `capture="environment"`, que en tablet y móvil abre **la cámara nativa
del aparato** en vez del explorador de archivos. La experiencia es: pulsar
«Añadir foto», disparar, volver.

En el servidor de hoy siempre tomará esa rama. La rama de vídeo en vivo no es
código muerto: se enciende sola el día que el servidor tenga HTTPS.

### El componente

`CamaraEvidencias.tsx`, nuevo, bajo `servicioComisariato/`. Lo que hace:

- Enseña las evidencias ya guardadas como miniaturas, cada una con una X para
  descartarla.
- Un botón «Añadir foto» que dispara la cámara —en vivo si se puede, nativa si
  no—.
- Sin límite de cuántas.
- Si las dos rutas fallan, un mensaje que dice **por qué**, no «este navegador
  no soporta la cámara», que es lo que dice hoy Walk Around y es falso.

### La compresión

Cada foto se reduce en el navegador antes de subirse: lado largo a **1280 px**,
JPEG al **70%**, con lo que una foto de tablet pasa de unos 3 MB a unos 200 KB.

No es un adorno. «Sin límite» con fotos a resolución de cámara significa veinte
imágenes de 3 MB: 60 MB de subida, un PDF que no se abre y un disco que crece
sin control. Con la compresión, veinte evidencias son unos 4 MB.

## 3. Los dos momentos

Son **el mismo juego de evidencias** visto desde dos sitios.

**En el formulario**, una sección opcional «Evidencias fotográficas» que puede
quedarse vacía. El servicio se guarda igual que hoy, sin fotos.

Al **crear**, el servicio todavía no tiene id, así que las fotos no pueden
colgarse de nada: el formulario guarda primero, lee el id de la respuesta y
sube las fotos contra él, una por petición. Al **editar**, suben contra el id
que ya existe.

Subir una por petición y no todas dentro del POST es deliberado: veinte
imágenes en base64 dentro del cuerpo del formulario chocan con `post_max_size`
de PHP, y un fallo deja sin guardar el servicio entero en vez de una foto.

**En la tabla**, un botón de cámara nuevo en la columna de acciones, junto a
Editar, Vista previa, Exportar PDF y Eliminar. Abre el mismo modal contra ese
registro y sube al momento, sin pasar por el formulario.

## 4. La API

Tres cosas nuevas bajo el prefijo `ServicioComisariato`:

| Ruta | Qué hace |
|---|---|
| `POST /{id}/evidencias` | Una foto por petición. Devuelve `{ id, url, orden }` |
| `DELETE /{id}/evidencias/{imagenId}` | Pone el pivote en `N` |
| `GET /{servicioComisariato}` | **Cambia**: ahora incluye `evidencias` |

El borrado lleva el id del **servicio** además del de la imagen, y no solo el
segundo. `imageables` es polimórfica y una misma `Imagen` podría estar colgada
de más de un dueño; con la ruta corta, un id equivocado despegaría la foto de
otro registro —de un Walk Around, por ejemplo— sin que nadie se enterara. Con
el servicio por delante, el controlador actúa sobre **ese** pivote y devuelve
404 si esa imagen no es suya.

El `orden` de una evidencia nueva es el mayor de las vigentes del servicio más
uno, contando también las retiradas, para que borrar la última y subir otra no
reutilice un número ya usado. En el pivote, `tag` queda en `'evidencia'`: hoy
no lo lee nadie, pero `imageables` lo comparte con Walk Around y un día habrá
que distinguir de dónde viene cada imagen.

El `show` de hoy devuelve el modelo pelado (`response()->json($servicio)`).
Pasa a cargar la relación y a devolver:

```json
{
  "id": 20,
  "matricula": "XA-TSR",
  "…": "…",
  "evidencias": [
    { "id": 7, "url": "http://…/storage/evidencias/…/a1b2.jpg", "orden": 0 }
  ]
}
```

Un servicio sin fotos devuelve `"evidencias": []`, no `null`: la pantalla y el
PDF recorren siempre una lista.

El borrado va por `DELETE` y no por `GET eliminar/{id}`, que es lo que hace el
resto del módulo. Esa costumbre es un defecto —un GET no debe cambiar estado,
y un prefetch del navegador puede dispararlo— y **no se corrige aquí**: queda
como deuda previa señalada, y las rutas nuevas no la heredan.

La subida lleva su **Form Request**, `GuardarEvidenciaComisariatoRequest`,
como pide el CLAUDE.md del proyecto. Valida la forma del base64 con la misma
regex endurecida del módulo de Seguridad:

```
/^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+\/]{16,}={0,2}\z/
```

El `=` solo como relleno final y el cierre en `\z`: con `[A-Za-z0-9+\/=]{16,}$`
dieciséis `=` pasaban la validación, `base64_decode` devolvía cadena vacía y se
escribía un archivo de cero bytes con su renglón en la base. En un módulo de
evidencias, una foto de cero bytes es una prueba que no existe.

El `store` existente valida en línea y sin Form Request. **No se toca**: es
deuda previa y no es el encargo.

## 5. El PDF

`ComisariatoPdfDoc` gana una sección **«Evidencias fotográficas»** después de
las firmas, en rejilla de **dos por renglón**. Con muchas fotos la sección
fluye sola a las páginas siguientes; el recibo en sí se queda en su página.

Un servicio sin evidencias no pinta la sección: ni el título ni un hueco.

`PdfComisariato.tsx` ya tiene una función `urlToDataUrl` **que hoy no llama
nadie** —código muerto desde que se escribió—. Las fotos la necesitan de
verdad, porque `@react-pdf/renderer` se atraganta con imágenes remotas y hay
que convertirlas a data URL antes de pintarlas. Pasa de muerta a útil en vez de
escribir otra al lado.

Las fotos se convierten **en paralelo** (`Promise.all`) y no en serie: veinte
peticiones encadenadas se notan.

Si una foto no se puede cargar —archivo borrado del disco a mano—, se omite en
vez de romper el PDF entero. El mismo criterio que usa `detalle()` en
`EntregaTurnoSeguridadController` con las firmas cuyo archivo ya no está.

La vista previa (`VistaPreviaComisariato`) enseña el mismo documento, así que
las evidencias salen ahí sin trabajo extra.

## 6. Archivos que se tocan

**Backend**

| Archivo | Qué |
|---|---|
| `app/Models/ServicioComisariato.php` | la relación `evidencias()` |
| `app/Http/Controllers/Api/ServicioComisariatoController.php` | `guardarEvidencia()`, `eliminarEvidencia()`, y `show` que carga la relación |
| `app/Http/Requests/ServicioComisariato/GuardarEvidenciaComisariatoRequest.php` | nuevo |
| `routes/api.php` | las dos rutas nuevas |

No hay migración: las dos tablas ya existen.

**Frontend** (bajo `resources/js/pages/Trafico/`)

| Archivo | Qué |
|---|---|
| `servicioComisariato/CamaraEvidencias.tsx` | nuevo: captura, miniaturas, borrar |
| `servicioComisariato/comprimirImagen.ts` | nuevo: el redimensionado a 1280 px |
| `servicioComisariato/ServicioComisariatoForm.tsx` | la sección opcional |
| `servicioComisariato/PdfComisariato.tsx` | la rejilla y el uso de `urlToDataUrl` |
| `ServicioComisariato.tsx` | el botón de cámara en acciones y su modal |
| `stores/apiServicioComisariato.ts` | subir y borrar evidencia |

`comprimirImagen.ts` va aparte y no dentro del componente a propósito: es
lógica sin interfaz, se prueba sola y el componente ya tiene bastante con la
cámara.

## 7. Pruebas

**Backend** (Pest, en serie, nunca `--parallel`):

- Subir una evidencia crea la `Imagen`, el renglón de `imageables` y **el
  archivo en el disco falso**.
- Dos subidas al mismo servicio dan dos evidencias con `orden` 0 y 1.
- Un base64 inválido se rechaza con 422 y **no** deja archivo ni renglón.
- Los dieciséis `=` de relleno se rechazan: es el caso que la regex vieja
  dejaba pasar.
- Borrar pone el pivote en `N` y la evidencia desaparece del `show`, pero el
  renglón de `imagens` sigue ahí.
- Borrar una imagen que **no es de ese servicio** da 404 y no despega nada:
  es lo que la ruta con los dos ids viene a impedir.
- El `orden` de la tercera evidencia es 2 aunque se haya borrado la segunda.
- El `show` de un servicio sin fotos devuelve `evidencias: []`.
- Sin sesión no se sube ni se borra nada.
- Subir a un servicio que no existe da 404.

**Frontend**: no hay runner de JavaScript en este proyecto (`package.json`
tiene `build`, `build:ssr`, `dev`, `format`, `lint`, `types`). La evidencia es
`npx tsc --noEmit` con el único error de base conocido, y `npm run build` con
salida 0.

La compresión y la cámara no se prueban automáticamente: la primera necesita
un `canvas` de verdad y la segunda un aparato. Se comprueban en el navegador,
con evidencia a la vista, y esto queda dicho aquí en vez de fingir cobertura.

## 8. Riesgos y limitaciones conocidas

**La cámara en vivo no se va a usar.** Mientras se entre por HTTP plano, la
rama de `getUserMedia` nunca corre. Existe por dos razones: se enciende sola
con HTTPS y es el patrón que el proyecto ya sigue en `FotoIne.tsx`. Pero hay
que saber que la ruta probada en la práctica va a ser la otra.

**Dos pantallas del proyecto están rotas por esto mismo.** Walk Around
(`EvidenciFotografica.tsx:79-83`) y Movimientos de vehículos
(`ModalMovimiento.tsx:54-58`) solo tienen `getUserMedia`, así que en producción
siempre enseñan su mensaje de error. **Fuera del alcance de esta spec**, pero
señalado porque se descubrió midiendo para ella.

**«Sin límite» es sin límite.** Nada impide cargar cien fotos a un servicio.
La compresión lo hace soportable, no imposible. Si algún día duele, el sitio
de poner un tope es el Form Request, contando las evidencias vigentes.

**Los archivos borrados no se recogen.** Poner el pivote en `N` esconde la
evidencia pero deja el archivo en el disco. Es lo mismo que hace el módulo con
las firmas retiradas, y es deliberado: en un documento de prueba, lo retirado
tiene que poder recuperarse.

**El PDF crece con las fotos.** Un recibo con veinte evidencias ronda los 4 MB.
Es lo esperado y es el coste de la función.

## 9. Fuera de alcance

- Arreglar la cámara de Walk Around y Movimientos de vehículos.
- Poner HTTPS en el servidor.
- Cambiar el `GET eliminar/{id}` del módulo por un `DELETE`.
- Convertir el `store` existente a Form Request.
- Editar, rotar o anotar una foto ya tomada: se borra y se vuelve a tomar.
- Evidencias en otros módulos.
- Recoger del disco los archivos de evidencias retiradas.
