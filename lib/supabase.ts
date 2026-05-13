import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// サーバーサイド用（Service Role Key でバケット操作可能）
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export const EVIDENCE_BUCKET = "fina-evidences"
