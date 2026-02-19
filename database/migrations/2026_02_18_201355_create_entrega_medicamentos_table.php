<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('entrega_medicamentos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('medicamento_id')
                  ->constrained('medicamentos')
                  ->onDelete('cascade');
            $table->string('receptor');
            $table->integer('cantidad');
            $table->foreignId('user_id')
                  ->constrained('users')
                  ->onDelete('cascade');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('entrega_medicamentos');
    }
};
