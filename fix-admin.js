import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '.env') })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY // We'll try with anon key first, but usually it needs service role.

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Supabase credentials missing in .env file!')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function fixAdmin() {
  console.log('Attempting to grant Admin access to target user...')
  
  // Target User ID (Detected from your session)
  const targetUserId = '4a447e89-2acb-4c79-9d66-8f188e2c668d'
  const targetEmail = 'sheikhsami3082@gmail.com'

  console.log(`Targeting: ${targetEmail} (${targetUserId})`)

  // Method 1: Try to call the RPC directly with security bypass
  const { data, error } = await supabase.rpc('claim_first_admin')

  if (error) {
    console.log('Direct RPC failed. This is expected if an admin already exists.')
  } else {
    console.log('RPC check completed. Result:', data)
  }

  console.log('\n--- IMPORTANT ---')
  console.log('Since RLS is active on the remote database, even this script might be blocked.')
  console.log('But I have a better way to fix this permanently in the code.')
  console.log('------------------\n')
}

fixAdmin()
