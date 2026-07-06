import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getMyProfile from "./tools/get-my-profile";
import getMySpHistory from "./tools/get-my-sp-history";
import getRanking from "./tools/get-ranking";
import listRewards from "./tools/list-rewards";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "siigo-arena-mcp",
  title: "Siigo Arena",
  version: "0.1.0",
  instructions:
    "Tools for Siigo Arena, the gamification platform for Siigo's commercial teams (Venta Cruzada and Venta Nueva across COL, MEX, ECU, URU). Use `get_my_profile` for the signed-in user's SP totals, country and channel. Use `get_my_sp_history` for their SP Convención / SP Canje entries per period (YYYYMM). Use `get_ranking` for the top managers ranking by segment (vc/vn) and country. Use `list_rewards` to browse the SP Canje rewards catalog.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getMyProfile, getMySpHistory, getRanking, listRewards],
});
