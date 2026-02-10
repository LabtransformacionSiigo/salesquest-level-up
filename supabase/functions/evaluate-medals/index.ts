import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface MedalEvaluation {
  medal_id: string;
  medal_name: string;
  awarded: boolean;
  xp_earned: number;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Authenticate the caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: callingUser }, error: authError } = await anonClient.auth.getUser(token);

    if (authError || !callingUser) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Only admins and managers can evaluate medals
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", callingUser.id)
      .single();

    if (!roleData || (roleData.role !== "ADMINISTRADOR" && roleData.role !== "GERENTE")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: admin or manager only" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { user_ids } = await req.json();

    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: "user_ids array is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Limit batch size to prevent abuse
    if (user_ids.length > 100) {
      return new Response(
        JSON.stringify({ error: "Maximum 100 user_ids per request" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Evaluating medals for ${user_ids.length} users`);

    // Fetch active medals
    const { data: medals, error: medalsError } = await supabase
      .from("medals")
      .select("*")
      .eq("active", true);

    if (medalsError) throw medalsError;

    console.log(`Found ${medals?.length || 0} active medals`);

    // Fetch existing user medals to avoid duplicates
    const { data: existingUserMedals, error: existingError } = await supabase
      .from("user_medals")
      .select("user_id, medal_id")
      .in("user_id", user_ids);

    if (existingError) throw existingError;

    const existingMedalKeys = new Set(
      (existingUserMedals || []).map((um) => `${um.user_id}_${um.medal_id}`)
    );

    const results: Record<string, MedalEvaluation[]> = {};
    const newMedalsToInsert: Array<{ user_id: string; medal_id: string }> = [];
    const xpUpdates: Record<string, number> = {};

    for (const userId of user_ids) {
      results[userId] = [];

      // Fetch user's sales count
      const { count: salesCount } = await supabase
        .from("sales")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);

      // Fetch user's total XP earned from sales
      const { data: salesData } = await supabase
        .from("sales")
        .select("xp_earned")
        .eq("user_id", userId);

      const totalXpFromSales = (salesData || []).reduce(
        (sum, s) => sum + (s.xp_earned || 0),
        0
      );

      // Get current month sales
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

      const { count: monthlySalesCount } = await supabase
        .from("sales")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", startOfMonth)
        .lte("created_at", endOfMonth);

      console.log(`User ${userId}: ${salesCount} total sales, ${monthlySalesCount} this month, ${totalXpFromSales} XP from sales`);

      for (const medal of medals || []) {
        const medalKey = `${userId}_${medal.id}`;

        // Skip if already earned
        if (existingMedalKeys.has(medalKey)) {
          continue;
        }

        let meetsCondition = false;

        switch (medal.condition_type) {
          case "PRIMERA_VENTA":
            meetsCondition = (salesCount || 0) >= 1;
            break;
          case "X_VENTAS_MES":
            meetsCondition = (monthlySalesCount || 0) >= medal.condition_value;
            break;
          case "VENTAS_TOTAL":
            meetsCondition = (salesCount || 0) >= medal.condition_value;
            break;
          case "XP_TOTAL":
            meetsCondition = totalXpFromSales >= medal.condition_value;
            break;
          default:
            console.log(`Unknown condition type: ${medal.condition_type}`);
            break;
        }

        if (meetsCondition) {
          console.log(`User ${userId} earned medal: ${medal.name}`);
          
          newMedalsToInsert.push({
            user_id: userId,
            medal_id: medal.id,
          });

          const xpReward = medal.xp_reward || 0;
          xpUpdates[userId] = (xpUpdates[userId] || 0) + xpReward;

          results[userId].push({
            medal_id: medal.id,
            medal_name: medal.name,
            awarded: true,
            xp_earned: xpReward,
          });
        }
      }
    }

    // Insert new medals
    if (newMedalsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from("user_medals")
        .insert(newMedalsToInsert);

      if (insertError) {
        console.error("Error inserting medals:", insertError);
        throw insertError;
      }

      console.log(`Inserted ${newMedalsToInsert.length} new medals`);
    }

    // Update XP for users who earned medals
    for (const [userId, xpToAdd] of Object.entries(xpUpdates)) {
      if (xpToAdd > 0) {
        // Get current XP
        const { data: profile } = await supabase
          .from("profiles")
          .select("xp")
          .eq("id", userId)
          .single();

        const newXp = (profile?.xp || 0) + xpToAdd;

        const { error: updateError } = await supabase
          .from("profiles")
          .update({ xp: newXp })
          .eq("id", userId);

        if (updateError) {
          console.error(`Error updating XP for user ${userId}:`, updateError);
        } else {
          console.log(`Updated user ${userId} XP to ${newXp} (+${xpToAdd})`);
        }
      }
    }

    const totalMedalsAwarded = newMedalsToInsert.length;
    const totalXpAwarded = Object.values(xpUpdates).reduce((sum, xp) => sum + xp, 0);

    return new Response(
      JSON.stringify({
        success: true,
        medals_awarded: totalMedalsAwarded,
        xp_awarded: totalXpAwarded,
        details: results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error evaluating medals";
    console.error("Error evaluating medals:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
