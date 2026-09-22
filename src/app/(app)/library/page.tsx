import { EquipmentTab } from '@/components/library/equipment-tab'
import { LibraryMovesTab } from '@/components/library/library-moves-tab'
import { WarmupsTab } from '@/components/library/warmups-tab'
import { PageHeader } from '@/components/shell/page-header'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { requireCoachId } from '@/lib/session'
import { listEquipment } from '@/services/equipment'
import { listExercises } from '@/services/exercises'
import { listTags } from '@/services/tags'
import { listWarmups } from '@/services/warmups'

export default async function LibraryPage() {
  const coachId = await requireCoachId()
  const [exerciseList, tagList, warmupList, equipmentList] = await Promise.all([
    listExercises(coachId),
    listTags(coachId),
    listWarmups(coachId),
    listEquipment(coachId),
  ])

  return (
    <>
      <PageHeader title="Library" />
      <div className="p-4 md:p-8">
        <Tabs defaultValue="moves">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="moves">Moves</TabsTrigger>
            <TabsTrigger value="warmups">Warm-ups</TabsTrigger>
            <TabsTrigger value="equipment">Equipment</TabsTrigger>
          </TabsList>
          <TabsContent value="moves">
            <LibraryMovesTab exercises={exerciseList} tags={tagList} />
          </TabsContent>
          <TabsContent value="warmups">
            <WarmupsTab warmups={warmupList} />
          </TabsContent>
          <TabsContent value="equipment">
            <EquipmentTab equipment={equipmentList} />
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}
