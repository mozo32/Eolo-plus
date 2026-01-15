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
        Schema::create('firmables', function (Blueprint $table) {
            $table->id();

            $table->foreignId('firma_id')->constrained('firmas')->cascadeOnDelete();

            $table->morphs('firmable');
            $table->string('rol')->nullable();
            $table->string('tag')->nullable();
            $table->unsignedInteger('orden')->default(0);
            $table->char('status', 1)->default('A');

            $table->timestamps();

            $table->unique(['firma_id', 'firmable_type', 'firmable_id', 'rol']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('firmables');
    }
};
