import 'server-only'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const secretKey = process.env.SUPABASE_SECRET_KEY!

// This client uses the SECRET key and must NEVER be imported into
// any file that has 'use client' at the top. The server-only import
// above will cause a build error if that ever happens by mistake.
export const supabaseAdmin = createClient(supabaseUrl, secretKey)