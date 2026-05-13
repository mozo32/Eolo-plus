<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\PaymentMethod;

class PaymentMethodSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $metodos = [
            ['name' => 'Visa'],
            ['name' => 'MasterCard'],
            ['name' => 'Amex'],
            ['name' => 'Transferencia'],
            ['name' => 'Cobro remoto'],
        ];

        foreach ($metodos as $metodo) {
            PaymentMethod::create($metodo);
        }
    }
}
