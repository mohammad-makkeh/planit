import { redirect } from 'next/navigation'
import { logoutAction } from '@/actions/auth'
import { ProfileForm } from '@/components/settings/profile-form'
import { PageHeader } from '@/components/shell/page-header'
import { Button } from '@/components/ui/button'
import { requireCoachId } from '@/lib/session'
import { getCoach } from '@/services/coaches'

export default async function SettingsPage() {
  const coachId = await requireCoachId()
  const coach = await getCoach(coachId)
  if (!coach) redirect('/login')

  return (
    <>
      <PageHeader title="Settings" />
      <div className="max-w-lg space-y-8 p-4 md:p-8">
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Profile & branding</h2>
          <p className="text-sm text-muted-foreground">
            Shown on your clients&rsquo; plans, share links, and PDFs.
          </p>
          <ProfileForm
            coach={{
              name: coach.name,
              title: coach.title,
              phone: coach.phone,
              email: coach.email,
              brandColor: coach.brandColor,
              logoUrl: coach.logoUrl,
            }}
          />
        </section>
        <form action={logoutAction}>
          <Button variant="outline" className="w-full" type="submit">
            Log out
          </Button>
        </form>
      </div>
    </>
  )
}
