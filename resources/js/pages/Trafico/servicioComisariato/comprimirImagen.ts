/**
 * Reduce una foto antes de subirla y la devuelve como data URL JPEG.
 *
 * No es un adorno: «sin límite» con fotos a resolución de tablet son veinte
 * imágenes de 3 MB, o sea 60 MB de subida y un PDF que no se abre. A 1280 px
 * y calidad 0.7 cada una ronda los 200 KB.
 *
 * Siempre sale JPEG, aunque entre un PNG: una foto de cámara no gana nada con
 * la compresión sin pérdida y sí pesa cinco veces más.
 */
const LADO_MAXIMO = 1280;

const CALIDAD = 0.7;

export function comprimirImagen(archivo: File | Blob): Promise<string> {
    return new Promise((resolver, rechazar) => {
        const lector = new FileReader();

        lector.onerror = () => rechazar(new Error('No se pudo leer la fotografía.'));

        lector.onload = () => {
            const imagen = new Image();

            imagen.onerror = () => rechazar(new Error('La fotografía no se pudo interpretar.'));

            imagen.onload = () => {
                const escala = Math.min(1, LADO_MAXIMO / Math.max(imagen.width, imagen.height));
                const lienzo = document.createElement('canvas');

                lienzo.width = Math.round(imagen.width * escala);
                lienzo.height = Math.round(imagen.height * escala);

                const contexto = lienzo.getContext('2d');

                if (contexto === null) {
                    rechazar(new Error('El navegador no permitió preparar la fotografía.'));
                    return;
                }

                contexto.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);

                resolver(lienzo.toDataURL('image/jpeg', CALIDAD));
            };

            imagen.src = String(lector.result);
        };

        lector.readAsDataURL(archivo);
    });
}
