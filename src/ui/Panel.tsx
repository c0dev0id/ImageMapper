import { project, setProjectName } from '../state/project.ts'
import { BaseMapSection } from './BaseMapSection.tsx'
import { Footer } from './Footer.tsx'
import { LayersSection } from './LayersSection.tsx'
import { Notices } from './Notices.tsx'
import { RoutesSection } from './RoutesSection.tsx'

export function Panel() {
  return (
    <aside class="panel">
      <header class="section">
        <h1>mappic</h1>
        <input
          class="project-name"
          aria-label="Project name"
          value={project.name}
          onChange={(e) => setProjectName(e.currentTarget.value.trim() || 'Untitled')}
        />
      </header>
      <Notices />
      <BaseMapSection />
      <LayersSection />
      <RoutesSection />
      <Footer />
    </aside>
  )
}
