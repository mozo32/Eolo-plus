<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('servicio_comisariatos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')
                  ->constrained()
                  ->cascadeOnDelete();
            $table->string('catering', 150)->nullable();
            $table->string('forma_pago', 100)->nullable();
            $table->string('matricula', 50)->nullable();
            $table->date('fecha_entrega');
            $table->time('hora_entrega');
            $table->text('detalle')->nullable();
            $table->string('solicitado_por', 150)->nullable();
            $table->string('atendio', 150)->nullable();
            $table->decimal('subtotal', 10, 2)->default(0);
            $table->decimal('total', 10, 2)->default(0);

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('servicio_comisariatos');
    }
};
