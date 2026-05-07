import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getParentData } from '@/lib/parent/actions'
import ParentDashboardClient from './ParentDashboardClient'

export default async function ParentDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Double-check the role server-side (middleware handles most cases,
  // but this prevents any edge-case bypass)
  const { data: userRecord } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!userRecord || userRecord.role !== 'parent') redirect('/login')

  const { parentName, parentEmail, children } = await getParentData()

  return (
    <ParentDashboardClient
      parentName={parentName}
      parentEmail={parentEmail}
      dbChildren={children}
    />
  )
}
