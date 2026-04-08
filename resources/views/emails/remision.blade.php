<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: 'Helvetica', Arial, sans-serif; margin: 0; padding: 20px; color: #111827; background-color: #f9fafb; }
        .container { max-width: 600px; margin: 0 auto; background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; }

        /* Header */
        .header-wrap { display: table; width: 100%; border: 2px solid #111111; margin-bottom: 20px; }
        .header-left { display: table-cell; width: 100px; background-color: #003E51; color: #ffffff; text-align: center; vertical-align: middle; padding: 20px 0; }
        .header-left-text { font-size: 22px; font-weight: bold; letter-spacing: 2px; }
        .header-mid { display: table-cell; padding: 15px; vertical-align: middle; }
        .header-title { font-size: 16px; font-weight: bold; text-transform: uppercase; margin: 0; }
        .header-sub { font-size: 11px; color: #374151; margin-top: 5px; }

        /* Section Titles */
        .section-title { font-size: 11px; font-weight: bold; background-color: #f3f4f6; padding: 6px; border: 1px solid #111111; text-transform: uppercase; margin-top: 20px; margin-bottom: 0; }

        /* Grid System */
        .grid { width: 100%; border-collapse: collapse; border-bottom: 1px solid #111111; }
        .grid td { border: 1px solid #111111; border-bottom: none; padding: 8px; vertical-align: top; width: 50%; }
        .grid-3 td { width: 33.33%; }

        .label { font-size: 8px; color: #374151; text-transform: uppercase; margin-bottom: 4px; display: block; }
        .value { font-size: 12px; font-weight: bold; margin: 0; }
        .total-box { background-color: #e5e7eb; }
        .total-value { color: #003E51; font-size: 14px; }

        /* Signatures */
        .signature-section { margin-top: 40px; width: 100%; }
        .signature-box { text-align: center; padding-top: 10px; }
        .signature-line { border-top: 1px solid #111111; width: 80%; margin: 0 auto; padding-top: 10px; }
        .signature-img { width: 150px; height: auto; max-height: 80px; margin-bottom: 10px; }

        .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #6b7280; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header-wrap">
            <div class="header-left">
                <span class="header-left-text">EOLO</span>
            </div>
            <div class="header-mid">
                <p class="header-title">Remisión de Suministro</p>
                <p class="header-sub">Folio: <strong>{{ $remision->folio }}</strong> | Fecha: {{ $remision->fecha }}</p>
            </div>
        </div>

        <h3 class="section-title">Información General</h3>
        <table class="grid">
            <tr>
                <td><span class="label">Cliente</span><p class="value">{{ $remision->cliente }}</p></td>
                <td><span class="label">Unidad / Pipa</span><p class="value">{{ $remision->unidad ?? 'N/A' }}</p></td>
            </tr>
            <tr>
                <td><span class="label">Operador</span><p class="value">{{ $remision->operador }}</p></td>
                <td><span class="label">Producto</span><p class="value">{{ $remision->producto ?? 'Combustible' }}</p></td>
            </tr>
        </table>

        <h3 class="section-title">Detalles de la Aeronave y Servicio</h3>
        <table class="grid grid-3">
            <tr>
                <td><span class="label">Matrícula</span><p class="value">{{ $remision->matricula }}</p></td>
                <td><span class="label">Tipo de Aeronave</span><p class="value">{{ $remision->aeronave_tipo }}</p></td>
                <td><span class="label">Destino</span><p class="value">{{ $remision->destino }}</p></td>
            </tr>
            <tr>
                <td><span class="label">Hora Llegada</span><p class="value">{{ $remision->hora_llegada }}</p></td>
                <td><span class="label">Hora Inicial</span><p class="value">{{ $remision->hora_inicial }}</p></td>
                <td><span class="label">Hora Final</span><p class="value">{{ $remision->hora_final }}</p></td>
            </tr>
        </table>

        <h3 class="section-title">Lecturas del Contador</h3>
        <table class="grid grid-3">
            <tr>
                <td><span class="label">Lectura Inicial</span><p class="value">{{ $remision->lectura_inicial }} L</p></td>
                <td><span class="label">Lectura Final</span><p class="value">{{ $remision->lectura_final }} L</p></td>
                <td class="total-box">
                    <span class="label">Total Suministrado</span>
                    <p class="value total-value">{{ $remision->total_litros }} L</p>
                </td>
            </tr>
            <tr>
                <td colspan="2"><span class="label">Presión Diferencial</span><p class="value">{{ $remision->presionDif }} PSI</p></td>
                <td><span class="label">Forma de Pago</span><p class="value">{{ $remision->forma_pago }}</p></td>
            </tr>
        </table>

        <table class="signature-section">
            <tr>
                <td class="signature-box">
                    @php
                        $firmaOperador = $remision->firmas->where('pivot.rol', 'operador')->first();
                        $firmaCliente = $remision->firmas->where('pivot.rol', 'cliente')->first();
                    @endphp

                    @if($firmaOperador)
                        <img src="{{ $message->embed(storage_path('app/public/' . $firmaOperador->path)) }}" class="signature-img">
                    @endif
                    <div class="signature-line">
                        <span class="label">Firma del Operador</span>
                        <p style="font-size: 10px; margin: 0;">{{ $remision->operador }}</p>
                    </div>
                </td>
                <td class="signature-box">
                    @if($firmaCliente)
                        <img src="{{ $message->embed(storage_path('app/public/' . $firmaCliente->path)) }}" class="signature-img">
                    @endif
                    <div class="signature-line">
                        <span class="label">Firma del Cliente</span>
                        <p style="font-size: 10px; margin: 0;">{{ $remision->cliente }}</p>
                    </div>
                </td>
            </tr>
        </table>

        <div class="footer">
            Este es un comprobante digital de suministro generado por Eolo Plus.
        </div>
    </div>
</body>
</html>
