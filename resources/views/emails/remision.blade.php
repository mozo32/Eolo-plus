<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <style>
        body {
            font-family: 'Helvetica', Arial, sans-serif;
            margin: 0;
            padding: 20px;
            color: #111827;
            background-color: #ffffff;
            font-size: 12px;
            position: relative;
        }

        .watermark {
            position: absolute;
            top: 180px;
            left: 110px;
            width: 390px;
            height: auto;
            opacity: 0.05;
            z-index: -1;
        }

        .header-wrap {
            width: 100%;
            margin-bottom: 20px;
            border-bottom: 2px solid #111111;
        }

        .section-title {
            font-size: 11px;
            font-weight: bold;
            background-color: #f3f4f6;
            padding: 8px;
            border: 1px solid #111111;
            text-transform: uppercase;
            margin-top: 15px;
        }

        .grid {
            width: 100%;
            border-collapse: collapse;
        }

        .grid td {
            border: 1px solid #111111;
            padding: 8px;
            vertical-align: top;
        }

        .label {
            font-size: 9px;
            color: #4b5563;
            text-transform: uppercase;
            display: block;
            margin-bottom: 2px;
        }

        .value {
            font-size: 11px;
            font-weight: bold;
        }

        .folio-text {
            color: #dc2626;
            font-weight: bold;
        }

        .matricula-value {
            font-size: 16px;
            font-weight: bold;
            color: #003E51;
        }

        .gauge-table {
            width: 100%;
            border-collapse: collapse;
            border: 1px solid #111111;
            height: 300px;
        }

        .gauge-left {
            border-right: 1px solid #111111;
            padding: 0;
            vertical-align: top;
            height: 300px;
        }

        .gauge-left-table {
            width: 100%;
            height: 300px;
            border-collapse: collapse;
        }

        .info-cell {
            padding: 10px;
            border-bottom: 1px solid #111111;
            vertical-align: top;
        }

        .total-cell {
            padding: 14px 12px;
            background-color: #f1f5f9;
            vertical-align: top;
            height: 150px;
        }

        .total-value {
            color: #003E51;
            font-size: 26px;
            font-weight: bold;
            display: block;
            margin-top: 8px;
        }

        .signature-img {
            max-width: 150px;
            max-height: 65px;
            height: auto;
            margin-bottom: 8px;
        }

        .signature-space {
            height: 65px;
            margin-bottom: 8px;
        }

        .signature-line {
            border-top: 1px solid #111111;
            width: 80%;
            padding-top: 5px;
            text-align: center;
            margin: 0 auto;
        }

        .footer-disclaimer {
            margin-top: 30px;
            font-size: 10px;
            color: #64748b;
            text-align: center;
            border-top: 1px solid #e2e8f0;
            padding-top: 10px;
        }
    </style>
</head>

<body>
    @php
        $formatNumber = function ($value) {
            return number_format((float) ($value ?? 0), 0, '.', ',');
        };

        $formatHora = function ($value) {
            if (!$value) {
                return '-';
            }

            $hora = (string) $value;

            if (str_contains($hora, 'T')) {
                $parts = explode('T', $hora);
                return substr($parts[1] ?? '', 0, 5) ?: '-';
            }

            return substr($hora, 0, 5);
        };

        $fOp = $remision->firmas->where('pivot.rol', 'operador')->first();
        $fCl = $remision->firmas->where('pivot.rol', 'cliente')->first();
    @endphp

    <img
        src="{{ $message->embed(public_path('1c463caa-e3a1-4093-a00b-1c0da40795f6.jpg')) }}"
        class="watermark"
    >

    <div class="header-wrap">
        <table width="100%">
            <tr>
                <td width="150">
                    <img src="{{ $message->embed(public_path('54657b8c-8428-41cc-a654-794ca81943d6.jpg')) }}" width="140">
                </td>

                <td style="padding-left: 20px;">
                    <h1 style="margin:0; font-size: 18px;">Remisión de Suministro</h1>
                    <p style="margin:0; color: #374151;">
                        <span class="folio-text">Folio: {{ $remision->folio }}</span>
                        <span> | Fecha: {{ $remision->fecha }}</span>
                    </p>
                </td>
            </tr>
        </table>
    </div>

    <div class="section-title">Información General</div>

    <table class="grid">
        <tr>
            <td width="50%">
                <span class="label">Cliente</span>
                <span class="value">{{ $remision->cliente }}</span>
            </td>

            <td width="50%">
                <span class="label">Unidad / Pipa</span>
                <span class="value">{{ $remision->unidad ?? 'N/A' }}</span>
            </td>
        </tr>

        <tr>
            <td>
                <span class="label">Operador</span>
                <span class="value">{{ $remision->operador }}</span>
            </td>

            <td>
                <span class="label">Producto</span>
                <span class="value">{{ $remision->producto ?? 'Turbosina JET A' }}</span>
            </td>
        </tr>
    </table>

    <div class="section-title">Detalles de la Aeronave y Servicio</div>

    <table class="grid">
        <tr>
            <td width="33%">
                <span class="label">Matrícula</span>
                <span class="matricula-value">{{ $remision->matricula }}</span>
            </td>

            <td width="33%">
                <span class="label">Equipo</span>
                <span class="value">{{ $remision->aeronave_tipo }}</span>
            </td>

            <td width="33%">
                <span class="label">Destino</span>
                <span class="value">{{ $remision->destino }}</span>
            </td>
        </tr>

        <tr>
            <td>
                <span class="label">Llegada de Autotanque</span>
                <span class="value">{{ $formatHora($remision->hora_llegada) }}</span>
            </td>

            <td>
                <span class="label">Inicio de Carga</span>
                <span class="value">{{ $formatHora($remision->hora_inicial) }}</span>
            </td>

            <td>
                <span class="label">Fin de Carga</span>
                <span class="value">{{ $formatHora($remision->hora_final) }}</span>
            </td>
        </tr>
    </table>

    <div class="section-title">Lecturas y Presión Diferencial</div>

    <table class="gauge-table">
        <tr>
            <td width="60%" class="gauge-left">
                <table class="gauge-left-table">
                    <tr>
                        <td class="info-cell">
                            <span class="label">Lectura Inicial</span>
                            <span class="value">{{ $formatNumber($remision->lectura_inicial) }} L</span>
                        </td>
                    </tr>

                    <tr>
                        <td class="info-cell">
                            <span class="label">Lectura Final</span>
                            <span class="value">{{ $formatNumber($remision->lectura_final) }} L</span>
                        </td>
                    </tr>

                    <tr>
                        <td class="info-cell">
                            <span class="label">Forma de Pago</span>
                            <span class="value">{{ $remision->forma_pago ?? '-' }}</span>
                        </td>
                    </tr>

                    <tr>
                        <td class="total-cell">
                            <span class="label">Total Suministrado</span>
                            <span class="total-value">{{ $formatNumber($remision->total_litros) }} L</span>
                        </td>
                    </tr>
                </table>
            </td>

            <td width="40%" align="center" style="padding: 14px; background-color: #ffffff; vertical-align: middle;">
                <div style="font-family: Arial, sans-serif; width: 150px;">
                    <span class="label" style="font-weight: bold; margin-bottom: 10px; color: #475569; font-size: 10px;">
                        PRESIÓN DIFERENCIAL
                    </span>

                    <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 35px; padding: 12px 5px;">
                        <table width="100%" border="0" cellpadding="0" cellspacing="0" style="font-size: 8px; color: #64748b; line-height: 11px;">
                            <tr>
                                <td align="center" style="padding-bottom: 5px;">P.S.I.</td>
                                <td width="30"></td>
                                <td align="center" style="padding-bottom: 5px;">KG/CM²</td>
                            </tr>

                            @php
                                $psi = $remision->presionDif ?? 0;
                                $kgValues = [0.0, 0.1, 0.3, 0.4, 0.6, 0.7, 0.8, 1.0, 1.1, 1.3, 1.4, 1.5, 1.7, 1.8, 2.0, 2.1];
                            @endphp

                            @for ($i = 0; $i <= 15; $i++)
                                @php
                                    $currentVal = $i * 2;
                                    $color = '#22c55e';

                                    if ($currentVal >= 8) {
                                        $color = '#eab308';
                                    }

                                    if ($currentVal >= 10) {
                                        $color = '#ef4444';
                                    }

                                    $isActive = ($psi >= $currentVal && $psi < ($currentVal + 2));
                                @endphp

                                <tr>
                                    <td align="right" width="30" style="height: 11px; border-right: 1px solid #cbd5e1; padding-right: 3px;">
                                        {{ $currentVal }}
                                    </td>

                                    <td width="30" style="background-color: #f1f5f9; position: relative; border-left: 1px solid #94a3b8; border-right: 1px solid #94a3b8; height: 11px;">
                                        @if($psi >= (30 - $currentVal))
                                            <div style="background-color: #3b82f6; height: 11px; width: 100%;"></div>
                                        @endif

                                        @if($isActive)
                                            <div style="position: absolute; top: 0; left: -5px; width: 40px; border-top: 2px dotted #ef4444; z-index: 10;"></div>
                                        @endif
                                    </td>

                                    <td align="left" width="35" style="height: 11px; border-left: 1px solid #cbd5e1; padding-left: 3px; color: {{ $color }}; font-weight: bold;">
                                        — {{ number_format($kgValues[$i], 1) }}
                                    </td>
                                </tr>
                            @endfor
                        </table>
                    </div>

                    <div style="margin-top: 8px; border: 2px solid #22c55e; border-radius: 10px; padding: 5px 15px; display: inline-block;">
                        <span style="font-size: 15px; color: #3b82f6; font-weight: bold;">
                            {{ number_format($psi, 2) }}
                            <small style="font-size: 10px;">PSI</small>
                        </span>
                    </div>
                </div>
            </td>
        </tr>
    </table>

    <table width="100%" style="margin-top: 35px;">
        <tr>
            <td width="45%" align="center">
                @if ($fOp)
                    <img src="{{ $message->embed(storage_path('app/public/' . $fOp->path)) }}" class="signature-img">
                @else
                    <div class="signature-space"></div>
                @endif

                <div class="signature-line">
                    <span class="label">Firma del Operador</span>
                    <span style="font-size: 10px;">{{ $remision->operador }}</span>
                </div>
            </td>

            <td width="10%"></td>

            <td width="45%" align="center">
                @if ($fCl)
                    <img src="{{ $message->embed(storage_path('app/public/' . $fCl->path)) }}" class="signature-img">
                @else
                    <div class="signature-space"></div>
                @endif

                <div class="signature-line">
                    <span class="label">Firma del Cliente</span>
                    <span style="font-size: 10px;">{{ $remision->cliente }}</span>
                </div>
            </td>
        </tr>
    </table>

    <div class="footer-disclaimer">
        <p>
            Acepto ser el representante del cliente y aeronave descrita, por lo que me obligo a pagar a
            <strong>Eolo Plus S.A. de C.V.</strong> el importe total por este servicio.
            <br>
            Contacto: <strong>sales@eolo.com.mx</strong>
        </p>
    </div>
</body>
</html>
