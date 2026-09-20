import { LibraryMovesTab } from '@/components/library/library-moves-tab'
import { PageHeader } from '@/components/shell/page-header'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { requireCoachId } from '@/lib/session'
import { listExercises } from '@/services/exercises'
import { listTags } from '@/services/tags'

export default async function LibraryPage() {
  const coachId = await requireCoachId()
  const [exerciseList, tagList] = await Promise.all([listExercises(coachId), listTags(coachId)])

  return (
    <>
      <PageHeader title="Library" />
      <div className="p-4 md:p-8">
        <Tabs defaultValue="moves">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="moves">Moves</TabsTrigger>
            <TabsTrigger value="warmups">Warm-ups</TabsTrigger>
          </TabsList>
          <TabsContent value="moves">
            <LibraryMovesTab exercises={exerciseList} tags={tagList} />
          </TabsContent>
          <TabsContent value="warmups">
            <p className="pt-4 text-sm text-muted-foreground">Warm-ups arrive in the next task.</p>
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}
