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
        Schema::create('walkaround_marca_danios', function (Blueprint $table) {
            $table->id();
            $table->foreignId('walk_around_id')->constrained('walk_arounds')->cascadeOnDelete();

            $table->double('x', 16, 12);
            $table->double('y', 16, 12);
            $table->double('z', 16, 12);

            // opcional (muy útil)
            $table->string('descripcion', 255)->nullable();
            $table->enum('severidad', ['leve', 'media', 'alta'])->nullable();
            $table->char('status', 1)->default('A');
            $table->timestamps();

            $table->index('walk_around_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('walkaround_marca_danios');
    }
};
