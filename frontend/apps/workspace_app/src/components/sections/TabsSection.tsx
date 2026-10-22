import { memo, useMemo } from 'react'
import { Check } from 'lucide-react'
import { byOrder } from '@/utils/collection'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Icon } from '@/components/shared/Icon'
import { SectionHeading } from '@/components/shared/SectionHeading'
import { Reveal } from '@/components/shared/Reveal'
import type { TabsSection as TabsSectionConfig } from '@/types/config'

function TabsSectionComponent({ section }: { section: TabsSectionConfig }) {
  const tabs = useMemo(() => byOrder(section.tabs), [section.tabs])
  if (tabs.length === 0) return null

  return (
    <section id={section.id} className="section-padding scroll-mt-16 bg-muted/30">
      <div className="container">
        <SectionHeading heading={section.heading} />
        <Reveal>
          <Tabs defaultValue={tabs[0].id} className="mx-auto max-w-4xl">
            <div className="flex justify-center">
              <TabsList className="h-auto flex-wrap">
                {tabs.map((tab) => (
                  <TabsTrigger key={tab.id} value={tab.id}>
                    {tab.icon && <Icon name={tab.icon} className="h-4 w-4" aria-hidden />}
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {tabs.map((tab) => (
              <TabsContent key={tab.id} value={tab.id} className="mt-8">
                <div className="grid items-center gap-8 rounded-2xl border bg-card p-8 shadow-sm md:grid-cols-2 md:p-10">
                  <div>
                    <h3 className="text-xl font-semibold md:text-2xl">{tab.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
                      {tab.description}
                    </p>
                    {tab.bullets.length > 0 && (
                      <ul className="mt-5 flex flex-col gap-2.5">
                        {tab.bullets.map((bullet) => (
                          <li key={bullet} className="flex items-start gap-2.5 text-sm">
                            <span className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-primary/10">
                              <Check className="h-3 w-3 text-primary" aria-hidden />
                            </span>
                            {bullet}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div
                    className="flex aspect-[4/3] items-center justify-center rounded-xl border bg-primary/5"
                    aria-hidden
                  >
                    {tab.icon && <Icon name={tab.icon} className="h-16 w-16 text-primary/40" />}
                  </div>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </Reveal>
      </div>
    </section>
  )
}

export default memo(TabsSectionComponent)
