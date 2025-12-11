import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SaleRow {
  email_ejecutivo: string;
  producto: string;
  cantidad: number;
  cliente: string;
  fecha?: string;
  notas?: string;
}

interface ProcessingError {
  row: number;
  field: string;
  message: string;
  data: Record<string, unknown>;
}

interface ProcessingResult {
  success: boolean;
  totalRows: number;
  successfulRows: number;
  failedRows: number;
  errors: ProcessingError[];
  salesInserted: number;
  totalXpAwarded: number;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get authorization header for user context
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user has permission (Admin or Manager)
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!userRole || (userRole.role !== 'ADMINISTRADOR' && userRole.role !== 'GERENTE')) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { rows, fileName } = await req.json() as { rows: SaleRow[]; fileName: string };
    
    console.log(`Processing ${rows.length} rows from file: ${fileName}`);

    // Fetch all executives and products for validation
    const { data: executives } = await supabase
      .from('profiles')
      .select('id, email, name, xp, manager_id');

    const { data: products } = await supabase
      .from('products')
      .select('id, name, xp_value')
      .eq('active', true);

    if (!executives || !products) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch reference data' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create lookup maps
    const executivesByEmail = new Map(executives.map(e => [e.email.toLowerCase(), e]));
    const productsByName = new Map(products.map(p => [p.name.toLowerCase(), p]));

    const errors: ProcessingError[] = [];
    const salesToInsert: Array<{
      user_id: string;
      product_id: string;
      quantity: number;
      client_name: string;
      xp_earned: number;
      notes: string | null;
      created_at: string;
      registered_by: string;
    }> = [];
    const xpUpdates = new Map<string, number>();

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // +2 because row 1 is header, and arrays are 0-indexed

      // Validate email_ejecutivo
      if (!row.email_ejecutivo || typeof row.email_ejecutivo !== 'string') {
        errors.push({
          row: rowNum,
          field: 'email_ejecutivo',
          message: 'Email del ejecutivo es requerido',
          data: row as unknown as Record<string, unknown>
        });
        continue;
      }

      const executive = executivesByEmail.get(row.email_ejecutivo.toLowerCase().trim());
      if (!executive) {
        errors.push({
          row: rowNum,
          field: 'email_ejecutivo',
          message: `Ejecutivo con email '${row.email_ejecutivo}' no encontrado`,
          data: row as unknown as Record<string, unknown>
        });
        continue;
      }

      // For managers, check if the executive is in their team
      if (userRole.role === 'GERENTE' && executive.manager_id !== user.id) {
        errors.push({
          row: rowNum,
          field: 'email_ejecutivo',
          message: `El ejecutivo '${row.email_ejecutivo}' no pertenece a tu equipo`,
          data: row as unknown as Record<string, unknown>
        });
        continue;
      }

      // Validate producto
      if (!row.producto || typeof row.producto !== 'string') {
        errors.push({
          row: rowNum,
          field: 'producto',
          message: 'Producto es requerido',
          data: row as unknown as Record<string, unknown>
        });
        continue;
      }

      const product = productsByName.get(row.producto.toLowerCase().trim());
      if (!product) {
        errors.push({
          row: rowNum,
          field: 'producto',
          message: `Producto '${row.producto}' no encontrado`,
          data: row as unknown as Record<string, unknown>
        });
        continue;
      }

      // Validate cantidad
      const cantidad = Number(row.cantidad);
      if (isNaN(cantidad) || cantidad < 1) {
        errors.push({
          row: rowNum,
          field: 'cantidad',
          message: 'Cantidad debe ser un número mayor a 0',
          data: row as unknown as Record<string, unknown>
        });
        continue;
      }

      // Validate cliente
      if (!row.cliente || typeof row.cliente !== 'string' || row.cliente.trim() === '') {
        errors.push({
          row: rowNum,
          field: 'cliente',
          message: 'Nombre del cliente es requerido',
          data: row as unknown as Record<string, unknown>
        });
        continue;
      }

      // Validate fecha (optional)
      let saleDate = new Date().toISOString();
      if (row.fecha) {
        const parsedDate = new Date(row.fecha);
        if (isNaN(parsedDate.getTime())) {
          errors.push({
            row: rowNum,
            field: 'fecha',
            message: `Fecha '${row.fecha}' no es válida. Use formato YYYY-MM-DD`,
            data: row as unknown as Record<string, unknown>
          });
          continue;
        }
        // Don't allow future dates
        if (parsedDate > new Date()) {
          errors.push({
            row: rowNum,
            field: 'fecha',
            message: 'La fecha no puede ser futura',
            data: row as unknown as Record<string, unknown>
          });
          continue;
        }
        saleDate = parsedDate.toISOString();
      }

      // Calculate XP
      const xpEarned = product.xp_value * cantidad;

      // Add to sales batch
      salesToInsert.push({
        user_id: executive.id,
        product_id: product.id,
        quantity: cantidad,
        client_name: row.cliente.trim(),
        xp_earned: xpEarned,
        notes: row.notas?.trim() || null,
        created_at: saleDate,
        registered_by: user.id
      });

      // Track XP updates
      const currentXp = xpUpdates.get(executive.id) || (executive.xp || 0);
      xpUpdates.set(executive.id, currentXp + xpEarned);
    }

    let salesInserted = 0;
    let totalXpAwarded = 0;

    // Insert sales in batches
    if (salesToInsert.length > 0) {
      const { error: insertError, count } = await supabase
        .from('sales')
        .insert(salesToInsert);

      if (insertError) {
        console.error('Error inserting sales:', insertError);
        return new Response(
          JSON.stringify({ 
            error: 'Error inserting sales', 
            details: insertError.message 
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      salesInserted = salesToInsert.length;

      // Update XP for each executive
      for (const [execId, newXp] of xpUpdates.entries()) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ xp: newXp })
          .eq('id', execId);

        if (updateError) {
          console.error(`Error updating XP for ${execId}:`, updateError);
        }
      }

      // Calculate total XP awarded
      totalXpAwarded = salesToInsert.reduce((sum, sale) => sum + sale.xp_earned, 0);
    }

    // Log the upload
    const { error: uploadLogError } = await supabase
      .from('sales_uploads')
      .insert({
        uploaded_by: user.id,
        file_name: fileName,
        total_rows: rows.length,
        successful_rows: salesInserted,
        failed_rows: errors.length,
        errors: errors
      });

    if (uploadLogError) {
      console.error('Error logging upload:', uploadLogError);
    }

    const result: ProcessingResult = {
      success: errors.length === 0,
      totalRows: rows.length,
      successfulRows: salesInserted,
      failedRows: errors.length,
      errors,
      salesInserted,
      totalXpAwarded
    };

    console.log(`Processing complete: ${salesInserted} sales, ${errors.length} errors, ${totalXpAwarded} XP awarded`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
