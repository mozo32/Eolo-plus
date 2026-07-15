<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Cierres de Medicamentos</title>
    <style>
        body {
            font-family: DejaVu Sans, sans-serif;
            font-size: 11px;
            color: #0f172a;
            margin: 28px;
        }

        .header {
            border-bottom: 2px solid #1e40af;
            padding-bottom: 12px;
            margin-bottom: 18px;
        }

        .title {
            font-size: 20px;
            font-weight: bold;
            text-transform: uppercase;
            color: #1e3a8a;
            margin: 0;
        }

        .subtitle {
            margin-top: 4px;
            color: #475569;
            font-size: 12px;
        }

        .cierre {
            margin-bottom: 28px;
            page-break-inside: avoid;
        }

        .cierre-header {
            background: #eff6ff;
            border: 1px solid #bfdbfe;
            padding: 10px;
            margin-bottom: 8px;
        }

        .cierre-title {
            font-size: 13px;
            font-weight: bold;
            text-transform: uppercase;
            color: #1e40af;
            margin-bottom: 4px;
        }

        .info {
            font-size: 10px;
            color: #334155;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 8px;
        }

        th {
            background: #f1f5f9;
            color: #475569;
            font-size: 9px;
            text-transform: uppercase;
            padding: 7px;
            border: 1px solid #cbd5e1;
            text-align: left;
        }

        td {
            padding: 7px;
            border: 1px solid #e2e8f0;
            font-size: 10px;
        }

        .text-center {
            text-align: center;
        }

        .agotado {
            color: #dc2626;
            font-weight: bold;
        }

        .reabastecer {
            color: #ea580c;
            font-weight: bold;
        }

        .disponible {
            color: #059669;
            font-weight: bold;
        }

        .sin-registros {
            text-align: center;
            padding: 30px;
            color: #64748b;
            font-weight: bold;
            text-transform: uppercase;
        }

        .footer {
            position: fixed;
            bottom: 10px;
            left: 28px;
            right: 28px;
            font-size: 9px;
            color: #64748b;
            border-top: 1px solid #e2e8f0;
            padding-top: 6px;
        }
    </style>
</head>
<body>
    @php
        function formatoFechaPdf($fecha) {
            if (!$fecha) return '';
            return \Carbon\Carbon::parse($fecha)->format('d/m/Y');
        }
    @endphp

    <div class="header">
        <h1 class="title">Reporte de Cierres de Turno</h1>
        <div class="subtitle">
            Control Médico | Periodo: {{ formatoFechaPdf($fechaInicio) }} al {{ formatoFechaPdf($fechaFin) }}
        </div>
    </div>

    @if($cierres->count() === 0)
        <div class="sin-registros">
            No se encontraron cierres de turno en el rango seleccionado.
        </div>
    @endif

    @foreach($cierres as $cierre)
        @php
            $medicamentos = $cierre->medicamentos;

            if (is_string($medicamentos)) {
                $medicamentos = json_decode($medicamentos, true) ?: [];
            }

            $aparatos = $cierre->aparatos;

            if (is_string($aparatos)) {
                $aparatos = json_decode($aparatos, true) ?: [];
            }
        @endphp

        <div class="cierre">
            <div class="cierre-header">
                <div class="cierre-title">
                    Cierre de Turno #{{ $cierre->id }}
                </div>

                <div class="info">
                    <strong>Responsable:</strong> {{ $cierre->responsable }}
                    &nbsp; | &nbsp;
                    <strong>Fecha:</strong> {{ formatoFechaPdf($cierre->fecha) }}
                    &nbsp; | &nbsp;
                    <strong>Día:</strong> {{ $cierre->dia }}
                </div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th>Medicamento</th>
                        <th class="text-center">Inicio</th>
                        <th class="text-center">Entregados</th>
                        <th class="text-center">Final</th>
                        <th class="text-center">Estatus</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach($medicamentos as $nombre => $data)
                        @php
                            $inicio = (int)($data['inicio'] ?? 0);
                            $final = (int)($data['final'] ?? 0);
                            $entregados = $inicio - $final;

                            if ($final === 0) {
                                $estatus = 'Agotado';
                                $clase = 'agotado';
                            } elseif ($final <= 5) {
                                $estatus = 'Reabastecer';
                                $clase = 'reabastecer';
                            } else {
                                $estatus = 'Disponible';
                                $clase = 'disponible';
                            }
                        @endphp

                        <tr>
                            <td>{{ strtoupper($nombre) }}</td>
                            <td class="text-center">{{ $inicio }}</td>
                            <td class="text-center">{{ $entregados }}</td>
                            <td class="text-center">{{ $final }}</td>
                            <td class="text-center {{ $clase }}">{{ $estatus }}</td>
                        </tr>
                    @endforeach
                </tbody>
            </table>

            <table>
                <thead>
                    <tr>
                        <th colspan="4">Aparatos verificados</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Oxímetro</td>
                        <td>{{ !empty($aparatos['oximetro']) ? 'Sí' : 'No' }}</td>
                        <td>Baumanómetro</td>
                        <td>{{ !empty($aparatos['baumanometro']) ? 'Sí' : 'No' }}</td>
                    </tr>
                    <tr>
                        <td>Monitor de Presión</td>
                        <td>{{ !empty($aparatos['monitor_presion']) ? 'Sí' : 'No' }}</td>
                        <td>Estetoscopio</td>
                        <td>{{ !empty($aparatos['estetoscopio']) ? 'Sí' : 'No' }}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    @endforeach

    <div class="footer">
        Generado el {{ now()->format('d/m/Y H:i') }} | Eolo Plus
    </div>
</body>
</html>
