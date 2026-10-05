<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>{{ $esCotizacion ? 'Cotización' : 'Prefactura '.$prefactura->folio }}</title>
    <style>
        body {
            font-family: DejaVu Sans, sans-serif;
            font-size: 10px;
            color: #0f172a;
            margin: 28px;
        }

        table {
            width: 100%;
            border-collapse: collapse;
        }

        .logo {
            width: 150px;
        }

        .emisor {
            text-align: right;
            font-size: 9px;
            color: #334155;
            line-height: 1.5;
        }

        .titulo-recuadro {
            background: #073b4b;
            color: #ffffff;
            margin-top: 12px;
        }

        .titulo-recuadro td {
            padding: 10px 12px;
        }

        .titulo {
            font-size: 16px;
            font-weight: bold;
        }

        .folio {
            text-align: right;
            font-size: 13px;
            font-weight: bold;
        }

        .leyenda {
            font-size: 9px;
            font-weight: normal;
        }

        .seccion {
            margin-top: 12px;
        }

        .seccion-titulo {
            font-size: 10px;
            font-weight: bold;
            color: #073b4b;
            border-bottom: 1px solid #073b4b;
            padding-bottom: 3px;
            margin-bottom: 5px;
        }

        .datos td {
            padding: 2px 4px 2px 0;
            font-size: 10px;
        }

        .etiqueta {
            color: #64748b;
            font-weight: bold;
        }

        .renglones {
            margin-top: 12px;
        }

        .renglones th {
            background: #f1f5f9;
            color: #475569;
            font-size: 9px;
            padding: 6px;
            border: 1px solid #cbd5e1;
            text-align: left;
        }

        .renglones td {
            padding: 6px;
            border: 1px solid #e2e8f0;
            font-size: 10px;
        }

        .derecha {
            text-align: right;
        }

        .centro {
            text-align: center;
        }

        .cortesia {
            color: #b45309;
            font-weight: bold;
        }

        .totales {
            width: 45%;
            margin-left: 55%;
            margin-top: 8px;
        }

        .totales td {
            padding: 4px 6px;
            font-size: 10px;
        }

        .totales .total td {
            background: #073b4b;
            color: #ffffff;
            font-weight: bold;
            font-size: 11px;
        }

        .firma {
            margin-top: 40px;
        }

        .firma td {
            width: 50%;
            text-align: center;
            padding: 0 20px;
        }

        .firma .linea {
            border-top: 1px solid #0f172a;
            padding-top: 4px;
        }

        .pie {
            margin-top: 24px;
            border-top: 1px solid #e2e8f0;
            padding-top: 6px;
            font-size: 8px;
            color: #64748b;
            text-align: center;
        }
    </style>
</head>
<body>
    {{--
        Esta vista FORMATEA: no llama a ningún método del modelo que calcule dinero ni que
        pueda lanzar. Todo llega en las nueve claves del array, que quien la llama tiene que
        armar dentro de su try/catch. Lo demás son atributos y relaciones, más `bccomp`,
        `number_format` y `format` de fechas: funciones de formato que no lanzan con las
        cadenas válidas que el contrato garantiza (con una entrada no numérica, `bccomp` y
        `number_format` sí lanzan). Importa porque la vista se renderiza DESPUÉS de ese
        try/catch: una excepción de cálculo nacida aquí sería un 500 en lugar de un 422.
        Por eso los importes de los renglones también viajan en el array, y tienen que
        calcularse sobre los mismos objetos que la vista recorre: así la vista no recalcula
        nada sobre datos que pudieran haber cambiado desde entonces.

        Las nueve claves:

            prefactura   FactPrefactura con renglones, pagos.formaPago, cliente,
                         aeronave.tipoAeronave y satelite.categoria (la categoría vive en
                         FactAeronave, que la prefactura llama `satelite`); quien llama las
                         carga con `with`, para que la vista no dispare una consulta
            esCotizacion bool: COTIZACIÓN sin folio, o documento emitido
            subtotal     cadena de 2 decimales (sellado o derivado, según el caso)
            iva          cadena de 2 decimales
            ivaEtiqueta  la tasa como porcentaje, p. ej. '16%'
            total        cadena de 2 decimales
            cambio       cadena de 2 decimales; la línea CAMBIO sale si es mayor que cero
            importes     array<int, string>: el importe de cada renglón (2 decimales),
                         indexado por id de renglón; la vista lo lee directo, sin valor por
                         omisión, así que una clave que falte revienta en lugar de imprimir
                         un cero
            elaboradoPor nombre de quien cerró, o de quien imprime

        `number_format` convierte a `float` por dentro y se acepta: la regla de «ningún
        float» protege la ARITMÉTICA, donde el error se acumula, y este es el último paso
        antes de imprimir: nada derivado de estos valores vuelve a entrar en un cálculo. La
        conversión es exacta mientras todo lo que pase por aquí sea una cadena de EXACTAMENTE
        dos decimales (`subtotal`, `iva`, `total`, `cambio`, `importes` y `pago->monto`, que
        tiene cast `decimal:2`) y no pase de 10^13. Ese umbral es un margen deliberado, no el
        punto donde falla: la cota teórica de un double es 2^53/100, unos 9x10^13, y en la
        práctica los centavos empiezan a perderse antes, entre ~3.5x10^13 y ~7x10^13. El
        tope de monto del sistema es 9999999999.99 (~10^10; lo fijan el `decimal(12,2)` de
        los totales sellados y `PagosPrefactura::MONTO_MAXIMO` de un pago), tres órdenes de
        magnitud bajo ese margen. Un total de cotización aún sin sellar no tiene ese tope en
        la columna, pero tendría que ser absurdo para acercarse. Si alguna vez entra un valor
        con más de dos decimales o por encima de 10^13, no se puede dar por exacto.
    --}}

    <table>
        <tr>
            <td>
                <img class="logo" src="{{ public_path('img/logo-facturacion.jpg') }}" alt="Eolo Plus">
            </td>
            <td class="emisor">
                RFC: EPL060619669<br>
                Carr Toluca-Atlacomulco KM 5.3<br>
                Toluca, Edo. de México<br>
                facturacion@eolo.com.mx
            </td>
        </tr>
    </table>

    <table class="titulo-recuadro">
        <tr>
            <td class="titulo">
                @if($esCotizacion)
                    COTIZACIÓN
                @else
                    PREFACTURA DE SERVICIOS
                @endif
            </td>
            <td class="folio">
                @if($esCotizacion)
                    <span class="leyenda">Sin folio — no es un documento emitido</span>
                @else
                    FOLIO: {{ $prefactura->folio }}
                @endif
            </td>
        </tr>
    </table>

    @php
        // La fecha del documento: cuando se cerró si está emitido, hoy si es cotización.
        $fechaDocumento = $esCotizacion ? now() : $prefactura->cerrada_at;

        // La aeronave, con la forma del documento viejo: el tipo y, entre paréntesis, la categoría.
        // Los dos pueden faltar (una matrícula nueva no los tiene hasta que alguien los captura): el
        // tipo ausente sale como «—» y la categoría ausente simplemente no se imprime.
        $tipoAeronave = $prefactura->aeronave?->tipoAeronave?->nombre ?: '—';
        $categoriaAeronave = $prefactura->satelite?->categoria?->nombre;
        $aeronaveTexto = $tipoAeronave.($categoriaAeronave ? ' ('.$categoriaAeronave.')' : '');
    @endphp

    <div class="seccion">
        <div class="seccion-titulo">DATOS DE OPERACIÓN</div>
        <table class="datos">
            <tr>
                <td><span class="etiqueta">Matrícula:</span> {{ $prefactura->aeronave?->matricula ?: '—' }}</td>
                <td><span class="etiqueta">Fecha:</span> {{ $fechaDocumento?->format('d/m/Y') ?? '—' }}</td>
            </tr>
            <tr>
                <td colspan="2"><span class="etiqueta">Aeronave:</span> {{ $aeronaveTexto }}</td>
            </tr>
            <tr>
                <td><span class="etiqueta">Llegada:</span> {{ $prefactura->llegada_at?->format('d/m/Y H:i') ?? '—' }}</td>
                <td><span class="etiqueta">Salida:</span> {{ $prefactura->salida_at?->format('d/m/Y H:i') ?? '—' }}</td>
            </tr>
            <tr>
                <td><span class="etiqueta">Origen:</span> {{ $prefactura->origen ?: '—' }}</td>
                <td><span class="etiqueta">Destino:</span> {{ $prefactura->destino ?: '—' }}</td>
            </tr>
        </table>
    </div>

    <div class="seccion">
        <div class="seccion-titulo">DETALLES DEL CLIENTE</div>
        <table class="datos">
            <tr>
                <td><span class="etiqueta">Nombre:</span> {{ $prefactura->cliente?->nombre ?: '—' }}</td>
            </tr>
            <tr>
                <td><span class="etiqueta">Teléfono:</span> {{ $prefactura->cliente?->telefono ?: '—' }}</td>
            </tr>
            <tr>
                <td><span class="etiqueta">Correo:</span> {{ $prefactura->cliente?->correo ?: '—' }}</td>
            </tr>
        </table>
    </div>

    <table class="renglones">
        <thead>
            <tr>
                <th>CONCEPTO / SERVICIO</th>
                <th>REMISIÓN</th>
                <th class="derecha">PRECIO U.</th>
                <th class="centro">CANT.</th>
                <th class="derecha">IMPORTE</th>
            </tr>
        </thead>
        <tbody>
            @foreach($prefactura->renglones as $renglon)
                <tr>
                    <td>
                        {{ $renglon->nombre_servicio }}
                        @if($renglon->es_cortesia)
                            <span class="cortesia">(Cortesía)</span>
                        @endif
                    </td>
                    <td>{{ $renglon->remision ?: '—' }}</td>
                    <td class="derecha">{{ (string) $renglon->precio_unitario }}</td>
                    <td class="centro">{{ $renglon->cantidad }}</td>
                    <td class="derecha">{{ number_format($importes[$renglon->id], 2) }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>

    <table class="totales">
        <tr>
            <td>SUBTOTAL</td>
            <td class="derecha">{{ number_format($subtotal, 2) }}</td>
        </tr>
        <tr>
            <td>IVA ({{ $ivaEtiqueta }})</td>
            <td class="derecha">{{ number_format($iva, 2) }}</td>
        </tr>
        <tr class="total">
            <td>TOTAL</td>
            <td class="derecha">{{ number_format($total, 2) }}</td>
        </tr>
    </table>

    <div class="seccion">
        <div class="seccion-titulo">FORMA DE PAGO</div>
        <table class="datos">
            @forelse($prefactura->pagos as $pago)
                <tr>
                    <td>{{ $pago->formaPago?->nombre ?: '—' }}</td>
                    <td class="derecha">{{ number_format($pago->monto, 2) }}</td>
                </tr>
            @empty
                <tr>
                    <td>Sin pagos registrados.</td>
                </tr>
            @endforelse
            @if(bccomp($cambio, '0', 2) > 0)
                <tr>
                    <td><strong>CAMBIO</strong></td>
                    <td class="derecha"><strong>{{ number_format($cambio, 2) }}</strong></td>
                </tr>
            @endif
        </table>
    </div>

    {{-- De las tres notas solo la externa sale en papel; la interna y la de factura no. --}}
    <div class="seccion">
        <div class="seccion-titulo">OBSERVACIONES</div>
        <div>{{ $prefactura->nota_externa ?: 'Sin observaciones adicionales.' }}</div>
    </div>

    <table class="firma">
        <tr>
            <td><div class="linea">FIRMA CLIENTE</div></td>
            <td><div class="linea">Elaborado por: {{ $elaboradoPor }}</div></td>
        </tr>
    </table>

    <div class="pie">
        Estimado cliente, usted cuenta con un máximo de 72 horas naturales posteriores a la fecha
        de emisión de esta prefactura para solicitar su factura fiscal. Tarifa de refacturación:
        MXN $250.00 + IVA. Contacto: facturacion@eolo.com.mx<br>
        Revisa Nuestro Aviso de Privacidad https://www.eolo.com.mx/#/privacidad
    </div>
</body>
</html>
