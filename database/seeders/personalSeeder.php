<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class PersonalSeeder extends Seeder
{
    public function run(): void
    {
        $puestos = DB::table('puestos')
            ->pluck('id', 'nombre');

        $data = [
            [27,  'PEÑA FABIAN JESUS ALEJANDRO', 'EJECUTIVO DE TRAFICO'],
            [223, 'LOPEZ IBARRA GASPAR', 'GESTOR VEHICULAR'],
            [407, 'MORALES GOMEZ GILBERTO', 'CHOFER'],
            [460, 'SUAREZ RAMIREZ KAREN', 'GERENTE DE SERV COMERCIALES'],
            [479, 'OCAMPO CONTRERAS ALFONSO', 'TRACTORISTA'],
            [629, 'HERNANDEZ GARCIA ALEJANDRO', 'GTE DE CONSERVACION Y MANTENI'],
            [790, 'SALAZAR OVANDO EDGAR', 'JEFE DE RAMPA'],
            [805, 'DURO HERAS CARLOS IGNACIO', 'ENCARGADO DE TURNO DE RAMPA'],
            [813, 'GARCIA RODRIGUEZ JESSICA MONSERRAT', 'COORDINADOR DE DESPACHO'],
            [829, 'DE LA O MARTINEZ LEONEL', 'OFICIAL DE RAMPA'],
            [883, 'PIÑA CONZUELO SERGIO ANTONIO', 'JEFE CONTABLE ADMINISTRATIVO'],
            [894, 'ROVEGLIA VAZQUEZ DANIEL', 'AUX CONTRALORIA'],
            [921, 'JARAMILLO MORENO MIGUEL', 'EJECUTIVO DE SISTEMAS'],
            [926, 'GARCIA ROSALES ALEJANDRO', 'EJECUTIVO DE TRAFICO'],
            [929, 'GUTIERREZ CARMONA JOSE LUIS', 'ENCARGADO DE TURNO DE RAMPA'],
            [940, 'PEÑA GONZALEZ ALDAIR', 'TRACTORISTA'],
            [956, 'NOLASCO SEGURA JULIO CESAR', 'ENCARGADO DE COMBUSTIBLE'],
            [962, 'SANCHEZ VENTOLERO JOSE LUIS', 'TRACTORISTA'],
            [964, 'SANCHEZ INIESTA RICARDO', 'TRACTORISTA'],
            [972, 'OSORIO ALVAREZ CARLOS EDUARDO', 'DESPACHADOR'],
            [976, 'GARCIA GARCIA ANA CRISTINA', 'ANALISTA COMERCIAL'],
            [984, 'REYES CASTILLO DENIS', 'GERENTE OPERACIONES FBO'],
            [985, 'SERRANO LOPEZ CARLOS EMILIANO', 'DESPACHADOR'],
            [990, 'CARBAJAL FABELA CASSANDRA DESIREE', 'JEFE DE TRAFICO'],
            [993, 'ESPINOSA NAVA DANIEL', 'OFICIAL DE RAMPA'],
            [994, 'ROMERO PEREZ MARGARITA', 'EJECUTIVO DE FACTURACION'],
            [996, 'SERRANO PIÑA RAYMUNDO', 'ENCARGADO DE TURNO DE RAMPA'],
            [997, 'LUGO PATIÑO BRYAN RUBEN', 'OFICIAL DE RAMPA'],
            [1000,'MIRANDA BELTRAN LAURA NABETSE', 'EJECUTIVO DE TRAFICO'],
            [1003,'CARO AYALA ULISES', 'OFICIAL DE RAMPA'],
            [1005,'BERNAL DIAZ ROBERTO', 'EJECUTIVO DE CUENTAS POR COBRA'],
            [1007,'HUERTA ROMERO BRANDON JAVIER', 'DESPACHADOR'],
            [1009,'SERRATO VARGAS MARIA GUADALUPE', 'EJECUTIVO DE TRAFICO'],
            [1011,'ENRIQUEZ VALDEZ CRISTIAN DANIEL', 'OFICIAL DE RAMPA'],
            [1012,'DIAZ GONZALEZ ROGELIO JAIR', 'TRACTORISTA'],
            [1014,'MARTINEZ HERNANDEZ LUIS ALEJANDRO', 'OFICIAL DE RAMPA'],
            [1015,'JARQUIN CORTEZ AXEL', 'DESPACHADOR'],
            [1016,'GARCIA GOMORA JOSE SAMUEL', 'OFICIAL DE RAMPA'],
            [1018,'TAPIA MEDINA JOSE FABIAN', 'ENCARGADO DE MANTENIMIENTO'],
            [1019,'VALDES SALAZAR FERNANDO', 'OFICIAL DE RAMPA'],
            [1021,'BELTRAN HIDALGO SAMUEL', 'TRACTORISTA'],
            [1023,'MARTINEZ ROSAS OCTAVIO', 'OFICIAL DE RAMPA'],
            [1027,'CARRASCO DIAZ JORGE', 'TRACTORISTA'],
            [1031,'PINEDA ORTEGA ADRIANA ODETTE', 'EJECUTIVO DE TRAFICO'],
            [1032,'RUIZ ALVAREZ OLLIN', 'AUX DE SEGURIDAD Y CALIDAD'],
            [1034,'MENDEZ CRUZ JOSE GUADALUPE', 'AUX DE MANTENIMIENTO'],
            [1035,'BECERRIL MARQUEZ DIEGO', 'OFICIAL DE RAMPA'],
            [1036,'MOZO RODRIGUEZ EDUARDO FELIPE', 'DESARROLADOR WEB'],
        ];

        foreach ($data as [$clave, $nombre, $puestoNombre]) {
            if (!isset($puestos[$puestoNombre])) {
                $this->command->warn("Puesto no encontrado: {$puestoNombre}");
                continue;
            }

            DB::table('personal')->insert([
                'clave'     => $clave,
                'nombre'    => $nombre,
                'puesto_id' => $puestos[$puestoNombre],
            ]);
        }
    }
}
