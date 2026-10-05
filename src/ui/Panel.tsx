import { BaseMapSection } from './BaseMapSection.tsx'
import { Footer } from './Footer.tsx'
import { LayersSection } from './LayersSection.tsx'
import { Notices } from './Notices.tsx'
import { ProjectSection } from './ProjectSection.tsx'
import { RoutesSection } from './RoutesSection.tsx'

export function Panel() {
  return (
    <aside class="panel">
      <ProjectSection />
      <Notices />
      <BaseMapSection />
      <LayersSection />
      <RoutesSection />
      <Footer />
    </aside>
  )
}
