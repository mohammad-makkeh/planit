import { LibraryMovesTab } from '@/components/library/library-moves-tab'
import { WarmupsTab } from '@/components/library/warmups-tab'
import { PageHeader } from '@/components/shell/page-header'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { requireCoachId } from '@/lib/session'
import { listEquipment } from '@/services/equipment'
import { listExercises } from '@/services/exercises'
import { listMuscleTargets } from '@/services/muscle-targets'
import { listWarmups } from '@/services/warmups'

export default async function LibraryPage() {
  const coachId = await requireCoachId()
  const [exerciseList, muscleTargetList, warmupList, equipmentList] = await Promise.all([
    listExercises(coachId),
    listMuscleTargets(),
    listWarmups(coachId),
    listEquipment(),
  ])

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
            <LibraryMovesTab exercises={exerciseList} muscleTargets={muscleTargetList} equipmentOptions={equipmentList} />
          </TabsContent>
          <TabsContent value="warmups">
            <WarmupsTab warmups={warmupList} />
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}
