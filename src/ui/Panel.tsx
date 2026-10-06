import { panelCollapsed } from '../state/ui.ts'
import { BaseMapSection } from './BaseMapSection.tsx'
import { Footer } from './Footer.tsx'
import { LayersSection } from './LayersSection.tsx'
import { Notices } from './Notices.tsx'
import { ProjectSection } from './ProjectSection.tsx'
import { RoutesSection } from './RoutesSection.tsx'
import { SearchSection } from './SearchSection.tsx'

export function Panel() {
  return (
    <aside class="panel" classList={{ collapsed: panelCollapsed() }}>
      <ProjectSection />
      <Notices />
      <SearchSection />
      <BaseMapSection />
      <LayersSection />
      <RoutesSection />
      <Footer />
    </aside>
  )
}
